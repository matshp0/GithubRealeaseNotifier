import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Insertable, Kysely } from 'kysely';
import type { DB, Verifications } from '../infrastructure/database/types.js';

declare module 'fastify' {
  interface FastifyInstance {
    verificationRepository: VerificationRepository;
  }
}

export class VerificationRepository {
  constructor(private readonly db: Kysely<DB>) {}

  create(data: Insertable<Verifications>) {
    return this.db
      .insertInto('verifications')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  markCancelledByToken(token: string) {
    return this.db
      .updateTable('verifications')
      .set({ status: 'cancelled' })
      .where('token', '=', token)
      .execute();
  }
}

export default fp(
  function (fastify: FastifyInstance, _opts: object, done: () => void) {
    fastify.decorate(
      'verificationRepository',
      new VerificationRepository(fastify.kysely),
    );
    done();
  },
  {
    name: 'verificationRepository',
    dependencies: ['kysely'],
  },
);
