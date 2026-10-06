import * as amqp from 'amqplib';
import {
  EMAIL_QUEUE,
  NOTIFICATIONS_EXCHANGE,
  RoutingKey,
} from '@github-notifier/contracts/mailer';
import type { Mailer } from '../mail/mailer.js';
import type { Logger } from '../logger.js';
import { handlers } from './handlers.js';

const PREFETCH = 5;

export interface ConsumerDeps {
  url: string;
  mailer: Mailer;
  appUrl: string;
  log: Logger;
}

export interface Consumer {
  close(): Promise<void>;
}

export async function startConsumer(deps: ConsumerDeps): Promise<Consumer> {
  const { url, mailer, appUrl, log } = deps;

  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  await channel.assertExchange(NOTIFICATIONS_EXCHANGE, 'topic', {
    durable: true,
  });
  await channel.assertQueue(EMAIL_QUEUE, { durable: true });
  for (const routingKey of Object.keys(handlers)) {
    await channel.bindQueue(EMAIL_QUEUE, NOTIFICATIONS_EXCHANGE, routingKey);
  }
  await channel.prefetch(PREFETCH);

  async function handle(message: amqp.ConsumeMessage): Promise<void> {
    const { routingKey } = message.fields;
    const handler = handlers[routingKey as RoutingKey];

    if (!handler) {
      log.warn({ routingKey }, 'Unknown routing key, discarding message');
      return;
    }

    const payload = JSON.parse(message.content.toString()) as unknown;
    const event = handler.schema.parse(payload);
    await handler.handle(event, { mailer, appUrl, log });
  }

  await channel.consume(EMAIL_QUEUE, (message) => {
    if (!message) return;
    void handle(message)
      .then(() => channel.ack(message))
      .catch((err: unknown) => {
        log.error(
          { err, routingKey: message.fields.routingKey },
          'Failed to process message, discarding',
        );
        channel.nack(message, false, false);
      });
  });

  log.info({ queue: EMAIL_QUEUE }, 'Email consumer ready');

  return {
    async close() {
      await channel.close();
      await connection.close();
    },
  };
}
