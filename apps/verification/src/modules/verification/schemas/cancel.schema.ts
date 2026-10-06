export const cancelVerificationSchema = {
  body: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string', format: 'uuid' },
    },
  },
} as const;
