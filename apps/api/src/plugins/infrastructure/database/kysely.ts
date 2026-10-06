import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './types.js';

declare module 'fastify' {
  export interface FastifyInstance {
    kysely: Kysely<DB>;
  }
}

export const getDb = (fastify: FastifyInstance) => {
  const log = fastify.log.child({ component: 'database' });

  const pool = new Pool({
    database: fastify.config.POSTGRES_DATABASE,
    host: fastify.config.POSTGRES_HOST,
    user: fastify.config.POSTGRES_USER,
    password: fastify.config.POSTGRES_PASSWORD,
    port: fastify.config.POSTGRES_PORT,
    max: 10,
  });

  pool.on('error', (err) => {
    log.error({ err }, 'Database: idle client error');
  });

  const dialect = new PostgresDialect({ pool });

  return new Kysely<DB>({
    dialect,
    plugins: [new CamelCasePlugin()],
    // Parameters are omitted on purpose — they may contain emails/tokens.
    log: (event) => {
      if (event.level === 'error') {
        log.error(
          { err: event.error, sql: event.query.sql },
          'Database: query failed',
        );
      } else {
        log.debug(
          { sql: event.query.sql, durationMs: event.queryDurationMillis },
          'Database: query executed',
        );
      }
    },
  });
};

export default fp(
  (fastify: FastifyInstance, _opts: object, done: () => void) => {
    fastify.decorate('kysely', getDb(fastify));

    fastify.addHook('onClose', async (instance) => {
      await instance.kysely.destroy();
    });

    done();
  },
  { name: 'kysely' },
);
