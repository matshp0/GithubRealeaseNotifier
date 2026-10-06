import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import * as amqp from 'amqplib';
import { NOTIFICATIONS_EXCHANGE } from '@github-notifier/contracts/mailer';

export interface Publisher {
  publish(routingKey: string, payload: unknown): Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    publisher: Publisher;
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    const connection = await amqp.connect(fastify.config.RABBITMQ_URL);
    const channel = await connection.createConfirmChannel();

    await channel.assertExchange(NOTIFICATIONS_EXCHANGE, 'topic', {
      durable: true,
    });

    const publisher: Publisher = {
      publish(routingKey, payload) {
        const body = Buffer.from(JSON.stringify(payload));
        const { promise, resolve, reject } = Promise.withResolvers<void>();
        channel.publish(
          NOTIFICATIONS_EXCHANGE,
          routingKey,
          body,
          { persistent: true, contentType: 'application/json' },
          (err) => {
            if (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            } else {
              resolve();
            }
          },
        );
        return promise;
      },
    };

    fastify.decorate('publisher', publisher);

    fastify.addHook('onClose', async () => {
      await channel.close();
      await connection.close();
    });
  },
  { name: 'publisher' },
);
