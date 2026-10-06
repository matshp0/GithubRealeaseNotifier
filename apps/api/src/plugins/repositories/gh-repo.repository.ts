import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Kysely, Insertable, Updateable, Selectable } from 'kysely';
import { DatabaseError } from 'pg';
import type { DB, Repositories } from '../infrastructure/database/types.js';
import { PgErrorCodes } from '../../common/constants/pgErrorCodes.js';
import { AlreadyExistsError } from '../../common/errors/index.js';

type RepositoryColumn = keyof Selectable<Repositories>;

interface OrderByOption {
  column: RepositoryColumn;
  direction?: 'asc' | 'desc';
}

declare module 'fastify' {
  interface FastifyInstance {
    ghRepoRepository: GhRepoRepository;
  }
}

export class GhRepoRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async create(data: Insertable<Repositories>) {
    try {
      return await this.db
        .insertInto('repositories')
        .values(data)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (
        err instanceof DatabaseError &&
        err.code === PgErrorCodes.UniqueViolation
      ) {
        throw new AlreadyExistsError('Repository already exists');
      }
      throw err;
    }
  }

  async findByFullName(fullName: string) {
    const result = await this.db
      .selectFrom('repositories')
      .selectAll()
      .where('fullName', '=', fullName)
      .executeTakeFirst();
    return result ?? null;
  }

  findAll(opts: OrderByOption) {
    let query = this.db.selectFrom('repositories').selectAll();
    const { column, direction = 'asc' } = opts;
    query = query.orderBy(column, direction);
    return query.execute();
  }

  updateById(
    id: string,
    data: Updateable<Repositories>,
    db: Kysely<DB> = this.db,
  ) {
    return db
      .updateTable('repositories')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}

export default fp(
  function (fastify: FastifyInstance, _opts: object, done: () => void) {
    const { kysely } = fastify;
    fastify.decorate('ghRepoRepository', new GhRepoRepository(kysely));
    done();
  },
  {
    name: 'ghRepoRepository',
    dependencies: ['kysely'],
  },
);
