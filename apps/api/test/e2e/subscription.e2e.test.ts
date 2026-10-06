import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import request from 'supertest';
import serviceApp from '@/app.ts';
import { truncateTables } from '@test/setup/db.ts';
import { resetQueue } from '@test/setup/rabbitmq.ts';

const VALID_EMAIL = 'e2e@test.com';
const VALID_REPO = 'owner/test-repo';

async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });
  fastify.register(fp(serviceApp));
  await fastify.ready();
  return fastify;
}

function mockOctokitRepos(
  fastify: FastifyInstance,
  overrides: {
    get?: ReturnType<typeof vi.fn>;
    getLatestRelease?: ReturnType<typeof vi.fn>;
  } = {},
) {
  Object.assign(fastify.octokit.repos, {
    get: vi.fn().mockResolvedValue({}),
    getLatestRelease: vi.fn().mockResolvedValue({
      data: { tag_name: 'v1.0.0' },
      headers: { etag: '"etag-abc"' },
    }),
    ...overrides,
  });
}

describe('Subscription API (e2e)', () => {
  let fastify: FastifyInstance;
  let agent: ReturnType<typeof request>;

  beforeAll(async () => {
    fastify = await buildApp();
    agent = request(fastify.server);
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetQueue();
    await truncateTables(fastify.kysely);
    mockOctokitRepos(fastify);
  });

  // ─── POST /api/subscribe ───────────────────────────────────────────────────

  describe('POST /api/subscribe', () => {
    it('returns 200 for valid email and repo', async () => {
      const res = await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL, repository: VALID_REPO });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: expect.stringContaining('Confirmation email sent'),
      });
    });

    it('returns 409 when subscribing same email to same repo twice', async () => {
      await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL, repository: VALID_REPO });

      const res = await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL, repository: VALID_REPO });

      expect(res.status).toBe(409);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await agent
        .post('/api/subscribe')
        .send({ email: 'not-an-email', repository: VALID_REPO });

      expect(res.status).toBe(400);
    });

    it('returns 400 when repository field is missing', async () => {
      const res = await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL });

      expect(res.status).toBe(400);
    });

    it('returns 404 when GitHub repo does not exist', async () => {
      mockOctokitRepos(fastify, {
        get: vi.fn().mockRejectedValue({ status: 404 }),
      });

      const res = await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL, repository: VALID_REPO });

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/confirm/:token ───────────────────────────────────────────────

  describe('GET /api/confirm/:token', () => {
    it('returns 200 for a valid confirm token', async () => {
      await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL, repository: VALID_REPO });

      const sub = await fastify.kysely
        .selectFrom('subscriptions')
        .select('confirmToken')
        .executeTakeFirstOrThrow();

      const res = await agent.get(`/api/confirm/${sub.confirmToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Subscription confirmed' });
    });

    it('returns 404 for an unknown UUID token', async () => {
      const res = await agent.get(
        '/api/confirm/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
    });

    it('returns 400 for a non-UUID token', async () => {
      const res = await agent.get('/api/confirm/not-a-uuid');

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/unsubscribe/:token ───────────────────────────────────────────

  describe('GET /api/unsubscribe/:token', () => {
    it('returns 200 for a valid unsub token', async () => {
      await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL, repository: VALID_REPO });

      const sub = await fastify.kysely
        .selectFrom('subscriptions')
        .select(['confirmToken', 'unsubToken'])
        .executeTakeFirstOrThrow();

      await agent.get(`/api/confirm/${sub.confirmToken}`);

      const res = await agent.get(`/api/unsubscribe/${sub.unsubToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Unsubscribed successfully' });
    });

    it('returns 404 for an unknown token', async () => {
      const res = await agent.get(
        '/api/unsubscribe/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/subscriptions ────────────────────────────────────────────────

  describe('GET /api/subscriptions', () => {
    it('returns confirmed subscriptions for an email', async () => {
      await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL, repository: VALID_REPO });

      const sub = await fastify.kysely
        .selectFrom('subscriptions')
        .select('confirmToken')
        .executeTakeFirstOrThrow();

      await agent.get(`/api/confirm/${sub.confirmToken}`);

      const res = await agent.get(`/api/subscriptions?email=${VALID_EMAIL}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        email: VALID_EMAIL,
        repository: VALID_REPO,
      });
    });

    it('returns empty array when subscription is still pending', async () => {
      await agent
        .post('/api/subscribe')
        .send({ email: VALID_EMAIL, repository: VALID_REPO });

      const res = await agent.get(`/api/subscriptions?email=${VALID_EMAIL}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('returns 400 when email query param is missing', async () => {
      const res = await agent.get('/api/subscriptions');

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await agent.get('/api/subscriptions?email=not-an-email');

      expect(res.status).toBe(400);
    });
  });
});
