import Fastify from 'fastify';
import fp from 'fastify-plugin';
import serviceApp from './app.js';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

function getLoggerOptions() {
  if (process.stdout.isTTY) {
    return {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    };
  }

  return { level: process.env.LOG_LEVEL ?? 'debug' };
}

const app = Fastify({
  logger: getLoggerOptions(),
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
    await app.listen({ port: process.env.PORT ?? 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void init();
