export interface Config {
  RABBITMQ_URL: string;
  MAIL_HOST: string;
  MAIL_PORT: number;
  MAIL_USER: string;
  MAIL_PASS: string;
  APP_URL: string;
  LOG_LEVEL: string;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    RABBITMQ_URL: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    MAIL_HOST: required('MAIL_HOST'),
    MAIL_PORT: Number(process.env.MAIL_PORT ?? 587),
    MAIL_USER: process.env.MAIL_USER ?? '',
    MAIL_PASS: process.env.MAIL_PASS ?? '',
    APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  };
}
