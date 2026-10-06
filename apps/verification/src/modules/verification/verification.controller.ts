import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createVerificationSchema } from './schemas/create.schema.js';
import { cancelVerificationSchema } from './schemas/cancel.schema.js';

// eslint-disable-next-line @typescript-eslint/require-await
const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/verifications',
    { schema: createVerificationSchema },
    async (request, reply) => {
      const result = await fastify.verificationService.createVerification(
        request.body,
      );
      return reply.code(201).send(result);
    },
  );

  fastify.post(
    '/verifications/cancel',
    { schema: cancelVerificationSchema },
    async (request, reply) => {
      await fastify.verificationService.cancelVerification(request.body);
      return reply.code(204).send();
    },
  );
};

export default plugin;
