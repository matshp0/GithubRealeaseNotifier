import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createMailer, createTransport } from './mail/mailer.js';
import { startConsumer } from './messaging/consumer.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const log = createLogger(config.LOG_LEVEL);

  const transporter = createTransport({
    host: config.MAIL_HOST,
    port: config.MAIL_PORT,
    user: config.MAIL_USER,
    pass: config.MAIL_PASS,
  });
  const mailer = createMailer(transporter);

  const consumer = await startConsumer({
    url: config.RABBITMQ_URL,
    mailer,
    appUrl: config.APP_URL,
    log,
  });

  log.info('Email service started');

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'Shutting down email service');
    await consumer.close();
    mailer.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('Email service failed to start', err);
  process.exit(1);
});
