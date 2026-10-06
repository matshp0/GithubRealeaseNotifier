export const confirmSchema = {
  params: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string', format: 'uuid' },
    },
  },
} as const;
