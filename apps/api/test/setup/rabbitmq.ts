import * as amqp from 'amqplib';
import {
  EMAIL_QUEUE,
  NOTIFICATIONS_EXCHANGE,
  RoutingKey,
} from '@github-notifier/contracts/mailer';

function url() {
  return process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
}

export interface PublishedMessage {
  routingKey: string;
  payload: Record<string, unknown>;
}

async function withChannel<T>(
  fn: (channel: amqp.Channel) => Promise<T>,
): Promise<T> {
  const connection = await amqp.connect(url());
  const channel = await connection.createChannel();
  try {
    await channel.assertExchange(NOTIFICATIONS_EXCHANGE, 'topic', {
      durable: true,
    });
    await channel.assertQueue(EMAIL_QUEUE, { durable: true });
    await channel.bindQueue(
      EMAIL_QUEUE,
      NOTIFICATIONS_EXCHANGE,
      RoutingKey.ConfirmationEmail,
    );
    await channel.bindQueue(
      EMAIL_QUEUE,
      NOTIFICATIONS_EXCHANGE,
      RoutingKey.ReleaseEmail,
    );
    return await fn(channel);
  } finally {
    await channel.close();
    await connection.close();
  }
}

/** Declares the email queue (if needed) and removes any buffered messages. */
export async function resetQueue() {
  await withChannel(async (channel) => {
    await channel.purgeQueue(EMAIL_QUEUE);
  });
}

/** Drains and returns every message currently sitting in the email queue. */
export async function getPublishedMessages(): Promise<PublishedMessage[]> {
  return withChannel(async (channel) => {
    const messages: PublishedMessage[] = [];
    for (;;) {
      const message = await channel.get(EMAIL_QUEUE, { noAck: true });
      if (!message) break;
      messages.push({
        routingKey: message.fields.routingKey,
        payload: JSON.parse(message.content.toString()) as Record<
          string,
          unknown
        >,
      });
    }
    return messages;
  });
}
