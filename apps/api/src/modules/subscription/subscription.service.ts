import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  AlreadyExistsError,
  ConflictError,
  NotFoundError,
} from '../../common/errors/index.js';
import type {
  ConfirmationEmailEvent,
  ReleaseEmailEvent,
} from '@github-notifier/contracts/mailer';
import type { ISubscriptionRepository } from '../../common/interfaces/repositories/subscription.repository.interface.js';
import type { IGithubService } from '../../common/interfaces/services/github.service.interface.js';
import type { ILogger } from '../../common/interfaces/logger.interface.js';
import type { VerificationClient } from '../../plugins/services/verification-client.js';

export interface Notifier {
  sendConfirmationEmail(event: ConfirmationEmailEvent): Promise<void>;
  sendReleaseNotification(event: ReleaseEmailEvent): Promise<void>;
}

export interface SubscriptionServiceDeps {
  githubService: IGithubService;
  subscriptionRepository: ISubscriptionRepository;
  verificationClient: VerificationClient;
  log: ILogger;
}

declare module 'fastify' {
  interface FastifyInstance {
    subscriptionService: ReturnType<typeof createSubscriptionService>;
  }
}

export function createSubscriptionService(deps: SubscriptionServiceDeps) {
  const { githubService, subscriptionRepository, verificationClient, log } =
    deps;

  // Saga compensations — best-effort, must never mask the original failure.
  async function compensateSubscription(subscriptionId: string) {
    try {
      await subscriptionRepository.delete(subscriptionId);
    } catch (err) {
      log.error(
        { err, subscriptionId },
        'Saga compensation failed: could not delete subscription',
      );
    }
  }

  async function compensateVerification(token: string) {
    try {
      await verificationClient.cancelVerification({ token });
    } catch (err) {
      log.error(
        { err },
        'Saga compensation failed: could not cancel verification',
      );
    }
  }

  return {
    // Orchestrated saga (api is the orchestrator):
    //   T1 (local)  create subscription
    //   T2 (remote) request verification  -> compensate: delete subscription
    //   T3 (local)  persist token + state -> compensate: cancel verification + delete subscription
    async subscribe(email: string, repoFullName: string) {
      log.info({ email, repo: repoFullName }, 'Subscribe saga: starting');
      const ghRepo = await githubService.ensureRepoExists(repoFullName);

      let subscription;
      try {
        subscription = await subscriptionRepository.create({
          email,
          repositoryId: ghRepo.id,
        });
      } catch (error) {
        if (error instanceof AlreadyExistsError) {
          throw new ConflictError(
            'Email already subscribed to this repository',
          );
        }
        throw error;
      }

      let token: string;
      try {
        const result = await verificationClient.createVerification({
          email,
          repoFullName,
          unsubToken: subscription.unsubToken,
        });
        token = result.token;
      } catch (error) {
        log.error(
          { err: error, subscriptionId: subscription.id },
          'Subscribe saga: verification request failed, compensating',
        );
        await compensateSubscription(subscription.id);
        throw error;
      }

      try {
        await subscriptionRepository.updateById(subscription.id, {
          confirmToken: token,
          status: 'awaiting_confirmation',
        });
      } catch (error) {
        log.error(
          { err: error, subscriptionId: subscription.id },
          'Subscribe saga: persisting verification failed, compensating',
        );
        await compensateVerification(token);
        await compensateSubscription(subscription.id);
        throw error;
      }

      log.info(
        { subscriptionId: subscription.id, email, repo: repoFullName },
        'Subscribe saga: completed',
      );
    },

    async confirmSubscription(token: string) {
      const subscription =
        await subscriptionRepository.findByConfirmToken(token);
      if (!subscription) {
        throw new NotFoundError('Token not found');
      }
      await subscriptionRepository.updateById(subscription.id, {
        status: 'confirmed',
      });
      log.info(
        { subscriptionId: subscription.id, email: subscription.email },
        'Subscription confirmed',
      );
    },

    async unsubscribe(token: string) {
      const subscription = await subscriptionRepository.findByUnsubToken(token);
      if (!subscription) {
        throw new NotFoundError('Token not found');
      }
      await subscriptionRepository.delete(subscription.id);
      log.info(
        { subscriptionId: subscription.id, email: subscription.email },
        'Subscription removed',
      );
    },

    async getSubscriptionsByEmail(email: string) {
      const subscriptions = await subscriptionRepository.findAllByEmail(email, {
        status: 'confirmed',
      });
      return subscriptions.map((s) => ({
        id: s.id,
        email: s.email,
        repository: s.repository,
      }));
    },
  };
}

export default fp(
  (fastify: FastifyInstance, _opts, done) => {
    fastify.decorate(
      'subscriptionService',
      createSubscriptionService({
        githubService: fastify.githubService,
        subscriptionRepository: fastify.subscriptionRepository,
        verificationClient: fastify.verificationClient,
        log: fastify.log,
      }),
    );
    done();
  },
  {
    name: 'subscriptionService',
    dependencies: ['ghRepoRepository', 'githubService', 'verificationClient'],
  },
);
