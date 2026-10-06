import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import serviceApp from '@/app.ts';
import { RoutingKey } from '@github-notifier/contracts/mailer';
import { truncateTables } from '@test/setup/db.ts';
import { getPublishedMessages, resetQueue } from '@test/setup/rabbitmq.ts';

const TEST_EMAIL = 'scanner@test.com';
const TEST_REPO = 'owner/test-repo';

async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });
  fastify.register(fp(serviceApp));
  await fastify.ready();
  return fastify;
}

function mockOctokitRequest(
  fastify: FastifyInstance,
  impl: ReturnType<typeof vi.fn>,
) {
  fastify.octokit.request = impl as unknown as typeof fastify.octokit.request;
}

function releaseResponse(tagName: string, etag = '"etag-new"') {
  return {
    data: { tag_name: tagName },
    headers: { etag },
    status: 200,
  };
}

async function seedRepo(
  fastify: FastifyInstance,
  fullName: string,
  lastSeenTag: string | null = null,
  etag: string | null = null,
) {
  return fastify.kysely
    .insertInto('repositories')
    .values({ fullName, lastSeenTag, etag })
    .returningAll()
    .executeTakeFirstOrThrow();
}

async function seedConfirmedSubscription(
  fastify: FastifyInstance,
  email: string,
  repositoryId: string,
) {
  return fastify.kysely
    .insertInto('subscriptions')
    .values({ email, repositoryId, status: 'confirmed' })
    .returningAll()
    .executeTakeFirstOrThrow();
}

describe('ScannerService (integration)', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = await buildApp();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetQueue();
    await truncateTables(fastify.kysely);
    mockOctokitRequest(
      fastify,
      vi.fn().mockResolvedValue(releaseResponse('v1.0.0')),
    );
  });

  describe('new release detected', () => {
    it('updates lastSeenTag, etag, and lastCheckedAt in the DB', async () => {
      const repo = await seedRepo(fastify, TEST_REPO, 'v1.0.0');
      mockOctokitRequest(
        fastify,
        vi.fn().mockResolvedValue(releaseResponse('v2.0.0', '"etag-new"')),
      );

      await fastify.scannerService.scan();

      const updated = await fastify.kysely
        .selectFrom('repositories')
        .selectAll()
        .where('id', '=', repo.id)
        .executeTakeFirstOrThrow();

      expect(updated.lastSeenTag).toBe('v2.0.0');
      expect(updated.etag).toBe('"etag-new"');
      expect(updated.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('publishes a release notification event for confirmed subscribers', async () => {
      const repo = await seedRepo(fastify, TEST_REPO, 'v1.0.0');
      await seedConfirmedSubscription(fastify, TEST_EMAIL, repo.id);
      mockOctokitRequest(
        fastify,
        vi.fn().mockResolvedValue(releaseResponse('v2.0.0')),
      );

      await fastify.scannerService.scan();

      const messages = await getPublishedMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].routingKey).toBe(RoutingKey.ReleaseEmail);
      expect(messages[0].payload).toMatchObject({
        email: TEST_EMAIL,
        repoFullName: TEST_REPO,
        tagName: 'v2.0.0',
      });
    });
  });

  describe('release unchanged', () => {
    it('updates etag and lastCheckedAt but not lastSeenTag', async () => {
      const repo = await seedRepo(fastify, TEST_REPO, 'v1.0.0', '"etag-old"');
      mockOctokitRequest(
        fastify,
        vi.fn().mockResolvedValue(releaseResponse('v1.0.0', '"etag-same"')),
      );

      await fastify.scannerService.scan();

      const updated = await fastify.kysely
        .selectFrom('repositories')
        .selectAll()
        .where('id', '=', repo.id)
        .executeTakeFirstOrThrow();

      expect(updated.lastSeenTag).toBe('v1.0.0');
      expect(updated.etag).toBe('"etag-same"');
      expect(updated.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('publishes no event when release is unchanged', async () => {
      const repo = await seedRepo(fastify, TEST_REPO, 'v1.0.0');
      await seedConfirmedSubscription(fastify, TEST_EMAIL, repo.id);
      mockOctokitRequest(
        fastify,
        vi.fn().mockResolvedValue(releaseResponse('v1.0.0')),
      );

      await fastify.scannerService.scan();

      const messages = await getPublishedMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('304 Not Modified', () => {
    it('updates lastCheckedAt and publishes no event', async () => {
      const repo = await seedRepo(
        fastify,
        TEST_REPO,
        'v1.0.0',
        '"stored-etag"',
      );
      await seedConfirmedSubscription(fastify, TEST_EMAIL, repo.id);
      mockOctokitRequest(
        fastify,
        vi.fn().mockRejectedValue({
          status: 304,
          response: { headers: { etag: '"stored-etag"' } },
        }),
      );

      await fastify.scannerService.scan();

      const updated = await fastify.kysely
        .selectFrom('repositories')
        .selectAll()
        .where('id', '=', repo.id)
        .executeTakeFirstOrThrow();

      expect(updated.lastCheckedAt).toBeInstanceOf(Date);
      expect(updated.lastSeenTag).toBe('v1.0.0');
      const messages = await getPublishedMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('no confirmed subscribers', () => {
    it('updates DB but publishes no event', async () => {
      await seedRepo(fastify, TEST_REPO, 'v1.0.0');
      mockOctokitRequest(
        fastify,
        vi.fn().mockResolvedValue(releaseResponse('v2.0.0')),
      );

      await fastify.scannerService.scan();

      const messages = await getPublishedMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('multiple repos', () => {
    it('processes all repos and updates each', async () => {
      const repo1 = await seedRepo(fastify, 'owner/repo-one', 'v1.0.0');
      const repo2 = await seedRepo(fastify, 'owner/repo-two', 'v2.0.0');
      mockOctokitRequest(
        fastify,
        vi
          .fn()
          .mockResolvedValueOnce(releaseResponse('v1.1.0', '"etag-1"'))
          .mockResolvedValueOnce(releaseResponse('v2.1.0', '"etag-2"')),
      );

      await fastify.scannerService.scan();

      const [r1, r2] = await Promise.all([
        fastify.kysely
          .selectFrom('repositories')
          .selectAll()
          .where('id', '=', repo1.id)
          .executeTakeFirstOrThrow(),
        fastify.kysely
          .selectFrom('repositories')
          .selectAll()
          .where('id', '=', repo2.id)
          .executeTakeFirstOrThrow(),
      ]);

      expect(r1.lastSeenTag).toBe('v1.1.0');
      expect(r2.lastSeenTag).toBe('v2.1.0');
    });

    it('publishes an event for subscribers of each updated repo', async () => {
      const repo1 = await seedRepo(fastify, 'owner/repo-one', 'v1.0.0');
      const repo2 = await seedRepo(fastify, 'owner/repo-two', 'v2.0.0');
      await seedConfirmedSubscription(fastify, 'sub1@test.com', repo1.id);
      await seedConfirmedSubscription(fastify, 'sub2@test.com', repo2.id);
      mockOctokitRequest(
        fastify,
        vi
          .fn()
          .mockResolvedValueOnce(releaseResponse('v1.1.0'))
          .mockResolvedValueOnce(releaseResponse('v2.1.0')),
      );

      await fastify.scannerService.scan();

      const messages = await getPublishedMessages();
      expect(messages).toHaveLength(2);
    });
  });
});
