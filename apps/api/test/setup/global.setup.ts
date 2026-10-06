import { execSync } from 'child_process';
import { GenericContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';

const PG_USER = 'testuser';
const PG_PASSWORD = 'testpassword';
const PG_DB = 'github_notifier_test';

export async function setup(project: TestProject) {
  const [pg, rabbitmq] = await Promise.all([
    new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_USER: PG_USER,
        POSTGRES_PASSWORD: PG_PASSWORD,
        POSTGRES_DB: PG_DB,
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage('database system is ready to accept connections'),
      )
      .start(),
    new GenericContainer('rabbitmq:4-alpine')
      .withExposedPorts(5672)
      .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
      .start(),
  ]);

  const dbUrl = `postgresql://${PG_USER}:${PG_PASSWORD}@${pg.getHost()}:${pg.getMappedPort(5432)}/${PG_DB}`;
  process.env.DATABASE_URL = dbUrl;

  execSync('node_modules/.bin/prisma migrate deploy', { stdio: 'inherit' });

  project.provide('POSTGRES_HOST', pg.getHost());
  project.provide('POSTGRES_PORT', String(pg.getMappedPort(5432)));
  project.provide('POSTGRES_USER', PG_USER);
  project.provide('POSTGRES_PASSWORD', PG_PASSWORD);
  project.provide('POSTGRES_DATABASE', PG_DB);
  project.provide(
    'RABBITMQ_URL',
    `amqp://${rabbitmq.getHost()}:${rabbitmq.getMappedPort(5672)}`,
  );

  return async () => {
    await Promise.all([pg.stop(), rabbitmq.stop()]);
  };
}
