export const getSubscriptionsSchema = {
  querystring: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
    },
    required: ['email'],
  },
} as const;
