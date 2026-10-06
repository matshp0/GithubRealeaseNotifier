import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Insertable, Kysely } from 'kysely';
import type {
  DB,
  NotificationOutbox,
} from '../infrastructure/database/types.js';

declare module 'fastify' {
  interface FastifyInstance {
    outboxRepository: OutboxRepository;
  }
}

export class OutboxRepository {
  constructor(private readonly db: Kysely<DB>) {}

  insertMany(
    events: Insertable<NotificationOutbox>[],
    db: Kysely<DB> = this.db,
  ) {
    return db.insertInto('notificationOutbox').values(events).execute();
  }

  findPendingForUpdate(limit: number, db: Kysely<DB>) {
    return db
      .selectFrom('notificationOutbox')
      .selectAll()
      .where('status', '=', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .forUpdate()
      .skipLocked()
      .execute();
  }

  markProcessed(id: string) {
    return this.db
      .updateTable('notificationOutbox')
      .set({ status: 'processed', processedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  markFailed(id: string, retryCount: number) {
    return this.db
      .updateTable('notificationOutbox')
      .set({ status: 'failed', retryCount })
      .where('id', '=', id)
      .execute();
  }

  updateRetry(id: string, retryCount: number) {
    return this.db
      .updateTable('notificationOutbox')
      .set({ retryCount })
      .where('id', '=', id)
      .execute();
  }
}

export default fp(
  function (fastify: FastifyInstance, _opts: object, done: () => void) {
    fastify.decorate('outboxRepository', new OutboxRepository(fastify.kysely));
    done();
  },
  {
    name: 'outboxRepository',
    dependencies: ['kysely'],
  },
);
