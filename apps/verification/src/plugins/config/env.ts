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
      RABBITMQ_URL: string;
    };
  }
}

const schema = {
  type: 'object',
  required: ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DATABASE'],
  properties: {
    PORT: {
      type: 'number',
      default: 3002,
    },
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
    RABBITMQ_URL: {
      type: 'string',
      default: 'amqp://localhost:5672',
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
