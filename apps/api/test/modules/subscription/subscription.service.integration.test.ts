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
import serviceApp from '@/app.ts';
import { truncateTables } from '@test/setup/db.ts';

const TEST_EMAIL = 'subscriber@test.com';
const TEST_REPO = 'owner/test-repo';
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';
const STUB_TOKEN = '11111111-1111-1111-1111-111111111111';

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

// The verification service is a separate microservice; stub the client so the
// subscribe saga step does not make a real HTTP call during api integration tests.
function mockVerificationClient(fastify: FastifyInstance) {
  Object.assign(fastify.verificationClient, {
    createVerification: vi.fn().mockResolvedValue({ token: STUB_TOKEN }),
    cancelVerification: vi.fn().mockResolvedValue(undefined),
  });
}

describe('SubscriptionService (integration)', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = await buildApp();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOctokitRepos(fastify);
    mockVerificationClient(fastify);
    await truncateTables(fastify.kysely);
  });

  // ─── subscribe() ───────────────────────────────────────────────────────────

  describe('subscribe()', () => {
    it('creates a subscription awaiting confirmation in the DB', async () => {
      await fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO);

      const rows = await fastify.kysely
        .selectFrom('subscriptions')
        .selectAll()
        .execute();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        email: TEST_EMAIL,
        status: 'awaiting_confirmation',
      });
    });

    it('requests verification and stores the returned token', async () => {
      await fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO);

      expect(
        vi.mocked(fastify.verificationClient.createVerification),
      ).toHaveBeenCalledWith({
        email: TEST_EMAIL,
        repoFullName: TEST_REPO,
        unsubToken: expect.any(String),
      });

      const sub = await fastify.kysely
        .selectFrom('subscriptions')
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(sub.confirmToken).toBe(STUB_TOKEN);
    });

    it('throws ConflictError when the same email subscribes to the same repo twice', async () => {
      await fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO);

      await expect(
        fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO),
      ).rejects.toMatchObject({ name: 'ConflictError' });
    });

    it('throws NotFoundError when the GitHub repo does not exist', async () => {
      mockOctokitRepos(fastify, {
        get: vi.fn().mockRejectedValue({ status: 404 }),
      });

      await expect(
        fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO),
      ).rejects.toMatchObject({ name: 'NotFoundError' });
    });
  });

  describe('confirmSubscription()', () => {
    it('sets the subscription status to confirmed', async () => {
      await fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO);
      const sub = await fastify.kysely
        .selectFrom('subscriptions')
        .selectAll()
        .executeTakeFirstOrThrow();

      await fastify.subscriptionService.confirmSubscription(sub.confirmToken);

      const updated = await fastify.kysely
        .selectFrom('subscriptions')
        .selectAll()
        .where('id', '=', sub.id)
        .executeTakeFirstOrThrow();
      expect(updated.status).toBe('confirmed');
    });

    it('throws NotFoundError for an unknown token', async () => {
      await expect(
        fastify.subscriptionService.confirmSubscription(FAKE_UUID),
      ).rejects.toMatchObject({ name: 'NotFoundError' });
    });
  });

  // ─── unsubscribe() ─────────────────────────────────────────────────────────

  describe('unsubscribe()', () => {
    it('removes the subscription from the DB', async () => {
      await fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO);
      const sub = await fastify.kysely
        .selectFrom('subscriptions')
        .selectAll()
        .executeTakeFirstOrThrow();

      await fastify.subscriptionService.unsubscribe(sub.unsubToken);

      const remaining = await fastify.kysely
        .selectFrom('subscriptions')
        .selectAll()
        .execute();
      expect(remaining).toHaveLength(0);
    });

    it('throws NotFoundError for an unknown token', async () => {
      await expect(
        fastify.subscriptionService.unsubscribe(FAKE_UUID),
      ).rejects.toMatchObject({ name: 'NotFoundError' });
    });
  });

  describe('getSubscriptionsByEmail()', () => {
    it('returns confirmed subscriptions with email and repository', async () => {
      await fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO);
      const sub = await fastify.kysely
        .selectFrom('subscriptions')
        .selectAll()
        .executeTakeFirstOrThrow();
      await fastify.subscriptionService.confirmSubscription(sub.confirmToken);

      const result =
        await fastify.subscriptionService.getSubscriptionsByEmail(TEST_EMAIL);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: TEST_EMAIL,
        repository: TEST_REPO,
      });
    });

    it('excludes pending subscriptions', async () => {
      await fastify.subscriptionService.subscribe(TEST_EMAIL, TEST_REPO);

      const result =
        await fastify.subscriptionService.getSubscriptionsByEmail(TEST_EMAIL);

      expect(result).toHaveLength(0);
    });
  });
});
