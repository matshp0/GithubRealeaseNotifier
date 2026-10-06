import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { RoutingKey } from '@github-notifier/contracts/mailer';
import type {
  CancelVerificationRequest,
  CreateVerificationRequest,
  CreateVerificationResponse,
} from '@github-notifier/contracts/verification';
import type { VerificationRepository } from '../../plugins/repositories/verification.repository.js';
import type { Publisher } from '../../plugins/infrastructure/rabbitmq/rabbitmq.js';
import type { ILogger } from '../../common/interfaces/logger.interface.js';

export interface VerificationServiceDeps {
  verificationRepository: VerificationRepository;
  publisher: Publisher;
  log: ILogger;
}

declare module 'fastify' {
  interface FastifyInstance {
    verificationService: ReturnType<typeof createVerificationService>;
  }
}

export function createVerificationService(deps: VerificationServiceDeps) {
  const { verificationRepository, publisher, log } = deps;

  return {
    async createVerification(
      req: CreateVerificationRequest,
    ): Promise<CreateVerificationResponse> {
      const { email, repoFullName, unsubToken } = req;

      const verification = await verificationRepository.create({
        email,
        repoFullName,
      });

      await publisher.publish(RoutingKey.ConfirmationEmail, {
        email,
        repoFullName,
        confirmToken: verification.token,
        unsubToken,
      });

      log.info(
        { verificationId: verification.id, email, repo: repoFullName },
        'Verification created, confirmation email published',
      );

      return { token: verification.token };
    },

    async cancelVerification(req: CancelVerificationRequest): Promise<void> {
      await verificationRepository.markCancelledByToken(req.token);
      log.info('Verification cancelled (saga compensation)');
    },
  };
}

export default fp(
  (fastify: FastifyInstance, _opts, done) => {
    fastify.decorate(
      'verificationService',
      createVerificationService({
        verificationRepository: fastify.verificationRepository,
        publisher: fastify.publisher,
        log: fastify.log,
      }),
    );
    done();
  },
  {
    name: 'verificationService',
    dependencies: ['verificationRepository', 'publisher'],
  },
);
