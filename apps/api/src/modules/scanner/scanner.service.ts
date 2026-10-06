import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Selectable } from 'kysely';
import { RoutingKey } from '@github-notifier/contracts/mailer';
import type { Repositories } from '../../plugins/infrastructure/database/types.js';
import { isGitHubApiError } from '../../common/errors/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    scannerService: ReturnType<typeof createScannerService>;
  }
}

export function createScannerService(fastify: FastifyInstance) {
  let suspendedUntil: Date | null = null;

  function isRateLimited(): boolean {
    if (!suspendedUntil) return false;
    if (new Date() >= suspendedUntil) {
      suspendedUntil = null;
      return false;
    }
    return true;
  }

  function applyRateLimit(headers: Record<string, string | undefined>) {
    const retryAfter = headers['retry-after'];
    const resetAt = headers['x-ratelimit-reset'];

    let waitSeconds = 60;

    if (retryAfter) {
      waitSeconds = parseInt(retryAfter, 10);
    } else if (resetAt) {
      const resetTimestamp = parseInt(resetAt, 10) * 1000;
      waitSeconds = Math.max(
        0,
        Math.ceil((resetTimestamp - Date.now()) / 1000),
      );
    }

    suspendedUntil = new Date(Date.now() + waitSeconds * 1000);
    return waitSeconds;
  }
  const {
    ghRepoRepository,
    subscriptionRepository,
    outboxRepository,
    kysely,
    octokit,
    log,
  } = fastify;

  async function fetchLatestRelease(
    owner: string,
    name: string,
    etag: string | null,
  ) {
    try {
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/releases/latest',
        {
          owner,
          repo: name,
          headers: etag ? { 'if-none-match': etag } : {},
        },
      );
      return {
        newTag: response.data?.tag_name ?? null,
        newEtag:
          (response.headers as Record<string, string | undefined>).etag ?? null,
      };
    } catch (error) {
      if (isGitHubApiError(error) && error.status === 404) {
        log.debug({ repo: `${owner}/${name}` }, 'Scanner: no releases found');
        return { newTag: null, newEtag: null };
      }
      throw error;
    }
  }

  async function handleNewRelease(
    repo: Selectable<Repositories>,
    newTag: string,
    newEtag: string | null,
  ) {
    log.info(
      { repo: repo.fullName, oldTag: repo.lastSeenTag, newTag },
      'Scanner: new release detected',
    );
    await kysely.transaction().execute(async (trx) => {
      await ghRepoRepository.updateById(
        repo.id,
        { lastSeenTag: newTag, etag: newEtag, lastCheckedAt: new Date() },
        trx,
      );

      const subscribers =
        await subscriptionRepository.findConfirmedByRepositoryId(repo.id, trx);

      if (subscribers.length === 0) return;

      await outboxRepository.insertMany(
        subscribers.map((sub) => ({
          routingKey: RoutingKey.ReleaseEmail,
          payload: {
            email: sub.email,
            repoFullName: repo.fullName,
            tagName: newTag,
            unsubToken: sub.unsubToken,
          },
        })),
        trx,
      );
    });
  }

  async function handleUnchanged(
    repo: Selectable<Repositories>,
    newEtag: string | null,
  ) {
    await ghRepoRepository.updateById(repo.id, {
      etag: newEtag,
      lastCheckedAt: new Date(),
    });
  }

  async function processRepo(repo: Selectable<Repositories>): Promise<boolean> {
    const [owner, name] = repo.fullName.split('/');

    try {
      const { newTag, newEtag } = await fetchLatestRelease(
        owner,
        name,
        repo.etag,
      );

      if (newTag && newTag !== repo.lastSeenTag) {
        await handleNewRelease(repo, newTag, newEtag);
      } else {
        await handleUnchanged(repo, newEtag);
      }

      return false;
    } catch (error) {
      if (!isGitHubApiError(error)) {
        log.error(
          { err: error, repo: repo.fullName },
          'Scanner: error checking repository',
        );
        return false;
      }

      if (error.status === 304) {
        const freshEtag = error.response?.headers?.etag ?? repo.etag;
        await ghRepoRepository.updateById(repo.id, {
          etag: freshEtag,
          lastCheckedAt: new Date(),
        });
        return false;
      }

      if (error.status === 429) {
        const headers = error.response?.headers ?? {};
        const waitSeconds = applyRateLimit(headers);
        log.warn(
          { waitSeconds, suspendedUntil },
          'Scanner: GitHub rate limit hit',
        );
        return true;
      }

      log.error(
        { err: error, repo: repo.fullName },
        'Scanner: error checking repository',
      );
      return false;
    }
  }

  return {
    async scan() {
      if (isRateLimited()) {
        log.warn({ suspendedUntil }, 'Scanner: rate limited, skipping scan');
        return;
      }

      const repos = await ghRepoRepository.findAll({
        column: 'lastCheckedAt',
        direction: 'asc',
      });
      log.info({ count: repos.length }, 'Scanner: starting scan');

      for (const repo of repos) {
        if (isRateLimited()) {
          log.warn(
            { suspendedUntil },
            'Scanner: rate limited mid-scan, stopping',
          );
          break;
        }

        const shouldStop = await processRepo(repo);
        if (shouldStop) break;
      }

      log.info('Scanner: scan complete');
    },
  };
}

export default fp(
  (fastify, _opts, done) => {
    fastify.decorate('scannerService', createScannerService(fastify));
    done();
  },
  {
    name: 'scannerService',
    dependencies: [
      'ghRepoRepository',
      'subscriptionRepository',
      'outboxRepository',
    ],
  },
);
