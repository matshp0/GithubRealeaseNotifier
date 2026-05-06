import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB } from './types.js';

declare module 'fastify' {
  export interface FastifyInstance {
    kysely: Kysely<DB>;
  }
}

export const getDb = (fastify: FastifyInstance) => {
  const dialect = new PostgresDialect({
    pool: new Pool({
      database: fastify.config.POSTGRES_DATABASE,
      host: fastify.config.POSTGRES_HOST,
      user: fastify.config.POSTGRES_USER,
      password: fastify.config.POSTGRES_PASSWORD,
      port: fastify.config.POSTGRES_PORT,
      ssl: fastify.config.POSTGRES_SSL ? { rejectUnauthorized: false } : false,
      max: 10,
    }),
  });
  return new Kysely<DB>({
    dialect,
    plugins: [new CamelCasePlugin()],
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
