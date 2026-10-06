function getLoggerOptions() {
  const esUrl = process.env.ELASTICSEARCH_URL;
  const logLevel = process.env.LOG_LEVEL ?? 'info';

  const esUser = process.env.ELASTICSEARCH_USER;
  const esPass = process.env.ELASTICSEARCH_PASS;

  const esTarget = esUrl
    ? {
        target: 'pino-elasticsearch',
        options: {
          index: 'github-notifier-logs',
          node: esUrl,
          flushBytes: 1000,
          ...(esUser && esPass
            ? { auth: { username: esUser, password: esPass } }
            : {}),
        },
        level: 'info' as const,
      }
    : null;

  const prettyTarget = {
    target: 'pino-pretty',
    options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    level: logLevel,
  };

  const fileTarget = {
    target: 'pino/file',
    options: { destination: 1 },
    level: logLevel,
  };

  const stdoutTarget = process.stdout.isTTY ? prettyTarget : fileTarget;

  const targets = [];
  targets.push(stdoutTarget);
  if (esTarget) targets.push(esTarget);

  return { level: logLevel, transport: { targets } };
}

const redact = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'confirmToken',
    'unsubToken',
    '*.confirmToken',
    '*.unsubToken',
    '*.password',
    '*.GITHUB_TOKEN',
    '*.MAIL_PASS',
    '*.POSTGRES_PASSWORD',
  ],
  censor: '[REDACTED]',
};

export function buildLoggerConfig() {
  return {
    ...getLoggerOptions(),
    base: { service: 'github-notifier' },
    redact,
  };
}
