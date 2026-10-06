import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  NotFoundError: 404,
  ConflictError: 409,
};

export function HttpErrorHandler(
  fastify: FastifyInstance,
): (err: FastifyError, request: FastifyRequest, reply: FastifyReply) => object {
  return (err, request, reply) => {
    const reqCtx = {
      method: request.method,
      url: request.url,
      query: request.query,
      params: request.params,
    };

    const domainStatus = DOMAIN_ERROR_STATUS[err.name];
    if (domainStatus) {
      fastify.log.warn({ err, request: reqCtx }, 'Domain error');
      reply.code(domainStatus);
      return { message: err.message };
    }

    reply.code(err.statusCode ?? 500);

    if (err.statusCode && err.statusCode < 500) {
      fastify.log.warn({ err, request: reqCtx }, 'Client error');
      return { message: err.message };
    }

    fastify.log.error({ err, request: reqCtx }, 'Unhandled error occurred');
    return { message: 'Internal Server Error' };
  };
}
