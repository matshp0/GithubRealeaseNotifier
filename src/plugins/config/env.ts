import env from '@fastify/env';

declare module 'fastify' {
  export interface FastifyInstance {
    config: {
      PORT: number;
      POSTGRES_HOST: string;
      POSTGRES_PORT: number;
      POSTGRES_USER: string;
      POSTGRES_PASSWORD: string;
      POSTGRES_DATABASE: string;
      POSTGRES_SSL: boolean;
      GITHUB_TOKEN: string;
      MAIL_HOST: string;
      MAIL_PORT: number;
      MAIL_USER: string;
      MAIL_PASS: string;
      APP_URL: string;
      SCAN_INTERVAL: number;
    };
  }
}

const schema = {
  type: 'object',
  required: [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DATABASE',
    'GITHUB_TOKEN',
    'MAIL_HOST',
    'MAIL_PORT',
    'MAIL_USER',
    'MAIL_PASS',
  ],
  properties: {
    POSTGRES_HOST: {
      type: 'string',
      default: 'localhost',
    },
    POSTGRES_PORT: {
      type: 'number',
      default: 5432,
    },
    POSTGRES_USER: {
      type: 'string',
    },
    POSTGRES_PASSWORD: {
      type: 'string',
    },
    POSTGRES_DATABASE: {
      type: 'string',
    },
    POSTGRES_SSL: {
      type: 'boolean',
      default: false,
    },
    GITHUB_TOKEN: {
      type: 'string',
    },
    MAIL_HOST: {
      type: 'string',
    },
    MAIL_PORT: {
      type: 'number',
      default: 587,
    },
    MAIL_USER: {
      type: 'string',
    },
    MAIL_PASS: {
      type: 'string',
    },
    APP_URL: {
      type: 'string',
      default: 'http://localhost:3000',
    },
    SCAN_INTERVAL: {
      type: 'number',
      default: 5,
    },
  },
};

export const autoConfig = {
  confKey: 'config',
  schema,
  dotenv: true,
  data: process.env,
};

export default env;
