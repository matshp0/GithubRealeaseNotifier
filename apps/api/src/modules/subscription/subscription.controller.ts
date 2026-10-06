import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { subscribeSchema } from './schemas/subscribe.schema.js';
import { confirmSchema } from './schemas/confirm.schema.js';
import { unsubscribeSchema } from './schemas/unsubscribe.schema.js';
import { getSubscriptionsSchema } from './schemas/getSubscriptions.schema.js';

// eslint-disable-next-line @typescript-eslint/require-await
const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/subscribe',
    { schema: subscribeSchema },
    async (request, reply) => {
      const { email, repository } = request.body;
      await fastify.subscriptionService.subscribe(email, repository);
      return reply
        .code(200)
        .send({ message: 'Subscription successful. Confirmation email sent.' });
    },
  );

  fastify.get(
    '/confirm/:token',
    { schema: confirmSchema },
    async (request, reply) => {
      const { token } = request.params;
      await fastify.subscriptionService.confirmSubscription(token);
      return reply.code(200).send({ message: 'Subscription confirmed' });
    },
  );

  fastify.get(
    '/unsubscribe/:token',
    { schema: unsubscribeSchema },
    async (request, reply) => {
      const { token } = request.params;
      await fastify.subscriptionService.unsubscribe(token);
      return reply.code(200).send({ message: 'Unsubscribed successfully' });
    },
  );

  fastify.get(
    '/subscriptions',
    { schema: getSubscriptionsSchema },
    async (request) => {
      const { email } = request.query;
      return fastify.subscriptionService.getSubscriptionsByEmail(email);
    },
  );
};

export default plugin;
