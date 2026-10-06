export const createVerificationSchema = {
  body: {
    type: 'object',
    required: ['email', 'repoFullName', 'unsubToken'],
    properties: {
      email: { type: 'string', format: 'email' },
      repoFullName: { type: 'string', pattern: '^[\\w.-]+/[\\w.-]+$' },
      unsubToken: { type: 'string' },
    },
  },
} as const;
