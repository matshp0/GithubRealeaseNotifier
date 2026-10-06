export const subscribeSchema = {
  body: {
    type: 'object',
    required: ['email', 'repository'],
    properties: {
      email: { type: 'string', format: 'email' },
      repository: { type: 'string', pattern: '^[\\w.-]+/[\\w.-]+$' },
    },
  },
} as const;
