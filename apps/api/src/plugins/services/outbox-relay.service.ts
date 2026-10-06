import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

const BATCH_SIZE = 10;
const MAX_RETRIES = 5;
const POLL_INTERVAL_MS = 5000;

export default fp(
  (fastify: FastifyInstance) => {
    const { kysely, outboxRepository, publisher, log } = fastify;

    async function processOutbox() {
      await kysely.transaction().execute(async (trx) => {
        const events = await outboxRepository.findPendingForUpdate(
          BATCH_SIZE,
          trx,
        );

        const results = await Promise.allSettled(
          events.map((event) =>
            publisher.publish(event.routingKey, event.payload),
          ),
        );

        await Promise.all(
          results.map(async (result, i) => {
            const event = events[i];
            if (result.status === 'fulfilled') {
              await outboxRepository.markProcessed(event.id);
              return;
            }
            const newRetryCount = event.retryCount + 1;
            if (newRetryCount >= MAX_RETRIES) {
              await outboxRepository.markFailed(event.id, newRetryCount);
              log.error(
                { id: event.id, retryCount: newRetryCount },
                'Outbox: event permanently failed',
              );
            } else {
              await outboxRepository.updateRetry(event.id, newRetryCount);
              log.warn(
                { err: result.reason, id: event.id, retryCount: newRetryCount },
                'Outbox: publish failed, will retry',
              );
            }
          }),
        );
      });
    }

    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      await processOutbox().catch((err: unknown) => {
        log.error({ err }, 'Outbox: relay poll failed');
      });
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    }

    fastify.addHook('onReady', () => {
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    });

    fastify.addHook('onClose', () => {
      clearTimeout(timer);
    });
  },
  {
    name: 'outboxRelay',
    dependencies: ['outboxRepository', 'publisher'],
  },
);
