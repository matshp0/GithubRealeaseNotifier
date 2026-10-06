import type {
  DB,
  Subscriptions,
  SubscriptionStatus,
} from '../infrastructure/database/types.js';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { DatabaseError } from 'pg';
import type { Insertable, Kysely, Updateable } from 'kysely';
import { PgErrorCodes } from '../../common/constants/pgErrorCodes.js';
import { AlreadyExistsError } from '../../common/errors/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    subscriptionRepository: SubscriptionRepository;
  }
}

export class SubscriptionRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async create(data: Insertable<Subscriptions>) {
    try {
      return await this.db
        .insertInto('subscriptions')
        .values(data)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (
        err instanceof DatabaseError &&
        err.code === PgErrorCodes.UniqueViolation
      ) {
        throw new AlreadyExistsError('Subscription already exists');
      }
      throw err;
    }
  }

  updateById(id: string, data: Updateable<Subscriptions>) {
    return this.db
      .updateTable('subscriptions')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findByConfirmToken(token: string) {
    const result = await this.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('confirmToken', '=', token)
      .executeTakeFirst();
    return result ?? null;
  }

  findAllByEmail(email: string, filter: { status?: SubscriptionStatus } = {}) {
    let query = this.db
      .selectFrom('subscriptions')
      .innerJoin(
        'repositories',
        'repositories.id',
        'subscriptions.repositoryId',
      )
      .selectAll('subscriptions')
      .select(['repositories.fullName as repository'])
      .where('subscriptions.email', '=', email);

    if (filter.status) {
      query = query.where('subscriptions.status', '=', filter.status);
    }

    return query.execute();
  }

  async findByUnsubToken(token: string) {
    const result = await this.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('unsubToken', '=', token)
      .executeTakeFirst();
    return result ?? null;
  }

  async findByEmailAndRepoId(email: string, repositoryId: string) {
    const result = await this.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('email', '=', email)
      .where('repositoryId', '=', repositoryId)
      .executeTakeFirst();
    return result ?? null;
  }

  findConfirmedByRepositoryId(repositoryId: string, db: Kysely<DB> = this.db) {
    return db
      .selectFrom('subscriptions')
      .selectAll()
      .where('repositoryId', '=', repositoryId)
      .where('status', '=', 'confirmed')
      .execute();
  }

  delete(id: string) {
    return this.db.deleteFrom('subscriptions').where('id', '=', id).execute();
  }
}

export default fp(
  function (fastify: FastifyInstance, _opts: object, done: () => void) {
    const { kysely } = fastify;
    fastify.decorate(
      'subscriptionRepository',
      new SubscriptionRepository(kysely),
    );
    done();
  },
  {
    name: 'subscriptionRepository',
    dependencies: ['kysely'],
  },
);
