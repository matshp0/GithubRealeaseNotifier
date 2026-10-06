export const unsubscribeSchema = {
  params: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string' },
    },
  },
} as const;
