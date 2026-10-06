import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  RoutingKey,
  type ConfirmationEmailEvent,
  type ReleaseEmailEvent,
} from '@github-notifier/contracts/mailer';
import type { Notifier } from '../../modules/subscription/subscription.service.js';
import type { ILogger } from '../../common/interfaces/logger.interface.js';
import type { Publisher } from '../infrastructure/rabbitmq/rabbitmq.js';

export interface NotifierDeps {
  publisher: Publisher;
  log: ILogger;
}

declare module 'fastify' {
  interface FastifyInstance {
    notifier: Notifier;
  }
}

export function createNotifier(deps: NotifierDeps): Notifier {
  const { publisher, log } = deps;

  return {
    sendConfirmationEmail(event: ConfirmationEmailEvent) {
      log.info(
        { to: event.email, repo: event.repoFullName },
        'Publishing confirmation email event',
      );
      return publisher.publish(RoutingKey.ConfirmationEmail, event);
    },

    sendReleaseNotification(event: ReleaseEmailEvent) {
      log.info(
        { to: event.email, repo: event.repoFullName, tag: event.tagName },
        'Publishing release notification event',
      );
      return publisher.publish(RoutingKey.ReleaseEmail, event);
    },
  };
}

export default fp(
  (fastify: FastifyInstance, _opts: object, done: () => void) => {
    fastify.decorate(
      'notifier',
      createNotifier({ publisher: fastify.publisher, log: fastify.log }),
    );
    done();
  },
  {
    name: 'notifier',
    dependencies: ['publisher'],
  },
);
