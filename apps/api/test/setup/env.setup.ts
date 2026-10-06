import { inject } from 'vitest';

declare module 'vitest' {
  interface ProvidedContext {
    POSTGRES_HOST: string;
    POSTGRES_PORT: string;
    POSTGRES_USER: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_DATABASE: string;
    RABBITMQ_URL: string;
  }
}

const injected: Record<string, string> = {
  POSTGRES_HOST: inject('POSTGRES_HOST'),
  POSTGRES_PORT: inject('POSTGRES_PORT'),
  POSTGRES_USER: inject('POSTGRES_USER'),
  POSTGRES_PASSWORD: inject('POSTGRES_PASSWORD'),
  POSTGRES_DATABASE: inject('POSTGRES_DATABASE'),
  RABBITMQ_URL: inject('RABBITMQ_URL'),
};

for (const [key, value] of Object.entries(injected)) {
  process.env[key] = value;
}

process.env.GITHUB_TOKEN ??= 'test-token';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.SCAN_INTERVAL ??= '60';
