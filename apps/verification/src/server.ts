import Fastify from 'fastify';
import fp from 'fastify-plugin';
import serviceApp from './app.js';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { buildLoggerConfig } from './common/logger.js';

const app = Fastify({
  logger: buildLoggerConfig(),
  ajv: {
    customOptions: {
      removeAdditional: 'all',
    },
  },
}).withTypeProvider<TypeBoxTypeProvider>();

async function init() {
  app.register(fp(serviceApp));

  await app.ready();

  try {
    const port = Number(process.env.PORT ?? 3002);
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void init();
