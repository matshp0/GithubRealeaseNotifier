import path from 'path';
import sensible from '@fastify/sensible';
import fastifyAutoload from '@fastify/autoload';
import formbody from '@fastify/formbody';
import { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import metricsPlugin from 'fastify-metrics';
import { HttpErrorHandler } from './common/errors/http-error-handler.js';

export default async function serviceApp(fastify: FastifyInstance) {
  fastify.setErrorHandler(HttpErrorHandler(fastify));

  await fastify.register(metricsPlugin.default, { endpoint: '/metrics' });

  await fastify.register(formbody);

  await fastify.register(sensible);

  await fastify.register(helmet, { contentSecurityPolicy: false });

  await fastify.register(fastifyAutoload, {
    dir: path.join(import.meta.dirname, 'plugins/config'),
  });

  await fastify.register(fastifyAutoload, {
    dir: path.join(import.meta.dirname, 'plugins/infrastructure'),
  });

  await fastify.register(fastifyAutoload, {
    dir: path.join(import.meta.dirname, 'plugins/repositories'),
  });

  await fastify.register(fastifyAutoload, {
    dir: path.join(import.meta.dirname, 'plugins/services'),
  });

  await fastify.register(fastifyAutoload, {
    dir: path.join(import.meta.dirname, 'modules'),
    dirNameRoutePrefix: false,
    options: { prefix: '/api' },
  });
}
