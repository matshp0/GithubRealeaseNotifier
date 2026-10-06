import { pino } from 'pino';

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(level: string) {
  const usePretty = process.stdout.isTTY;

  return pino({
    level,
    base: { service: 'github-notifier-email' },
    redact: {
      paths: ['confirmToken', 'unsubToken', '*.confirmToken', '*.unsubToken'],
      censor: '[REDACTED]',
    },
    ...(usePretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
          },
        }
      : {}),
  });
}
