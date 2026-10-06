import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubscriptionService } from '@/modules/subscription/subscription.service.ts';
import {
  AlreadyExistsError,
  ConflictError,
  NotFoundError,
} from '@/common/errors/index.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMockDeps() {
  return {
    githubService: { ensureRepoExists: vi.fn() },
    subscriptionRepository: {
      create: vi.fn(),
      updateById: vi.fn(),
      findByConfirmToken: vi.fn(),
      findByUnsubToken: vi.fn(),
      findAllByEmail: vi.fn(),
      delete: vi.fn(),
    },
    verificationClient: {
      createVerification: vi.fn().mockResolvedValue({ token: 'verif-tok' }),
      cancelVerification: vi.fn().mockResolvedValue(undefined),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function buildRepo(overrides = {}) {
  return { id: 'repo-1', fullName: 'owner/repo', ...overrides };
}

function buildSubscription(overrides = {}) {
  return {
    id: 'sub-1',
    email: 'user@test.com',
    repositoryId: 'repo-1',
    status: 'pending' as const,
    confirmToken: 'confirm-tok',
    unsubToken: 'unsub-tok',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createSubscriptionService', () => {
  let deps: ReturnType<typeof buildMockDeps>;
  let service: ReturnType<typeof createSubscriptionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = buildMockDeps();
    service = createSubscriptionService(deps);
  });

  describe('subscribe()', () => {
    it('ensures the repo exists, creates a subscription, requests verification and stores the returned token', async () => {
      const repo = buildRepo();
      const subscription = buildSubscription();
      deps.githubService.ensureRepoExists.mockResolvedValue(repo);
      deps.subscriptionRepository.create.mockResolvedValue(subscription);

      await service.subscribe('user@test.com', 'owner/repo');

      expect(deps.githubService.ensureRepoExists).toHaveBeenCalledWith(
        'owner/repo',
      );
      expect(deps.subscriptionRepository.create).toHaveBeenCalledWith({
        email: 'user@test.com',
        repositoryId: repo.id,
      });
      expect(deps.verificationClient.createVerification).toHaveBeenCalledWith({
        email: 'user@test.com',
        repoFullName: 'owner/repo',
        unsubToken: subscription.unsubToken,
      });
      expect(deps.subscriptionRepository.updateById).toHaveBeenCalledWith(
        subscription.id,
        { confirmToken: 'verif-tok', status: 'awaiting_confirmation' },
      );
    });

    it('throws ConflictError when email is already subscribed to the repository', async () => {
      deps.githubService.ensureRepoExists.mockResolvedValue(buildRepo());
      deps.subscriptionRepository.create.mockRejectedValue(
        new AlreadyExistsError('Subscription already exists'),
      );

      await expect(
        service.subscribe('user@test.com', 'owner/repo'),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(deps.verificationClient.createVerification).not.toHaveBeenCalled();
    });

    it('compensates by deleting the subscription when the verification request fails', async () => {
      const subscription = buildSubscription();
      deps.githubService.ensureRepoExists.mockResolvedValue(buildRepo());
      deps.subscriptionRepository.create.mockResolvedValue(subscription);
      deps.verificationClient.createVerification.mockRejectedValue(
        new Error('verification service down'),
      );

      await expect(
        service.subscribe('user@test.com', 'owner/repo'),
      ).rejects.toThrow('verification service down');

      expect(deps.subscriptionRepository.delete).toHaveBeenCalledWith(
        subscription.id,
      );
      expect(deps.verificationClient.cancelVerification).not.toHaveBeenCalled();
    });

    it('compensates by cancelling verification and deleting the subscription when persisting the token fails', async () => {
      const subscription = buildSubscription();
      deps.githubService.ensureRepoExists.mockResolvedValue(buildRepo());
      deps.subscriptionRepository.create.mockResolvedValue(subscription);
      deps.subscriptionRepository.updateById.mockRejectedValue(
        new Error('db write failed'),
      );

      await expect(
        service.subscribe('user@test.com', 'owner/repo'),
      ).rejects.toThrow('db write failed');

      expect(deps.verificationClient.cancelVerification).toHaveBeenCalledWith({
        token: 'verif-tok',
      });
      expect(deps.subscriptionRepository.delete).toHaveBeenCalledWith(
        subscription.id,
      );
    });
  });

  describe('confirmSubscription()', () => {
    it('sets status to confirmed for a valid token', async () => {
      const subscription = buildSubscription();
      deps.subscriptionRepository.findByConfirmToken.mockResolvedValue(
        subscription,
      );

      await service.confirmSubscription('confirm-tok');

      expect(deps.subscriptionRepository.updateById).toHaveBeenCalledWith(
        subscription.id,
        { status: 'confirmed' },
      );
    });

    it('throws NotFoundError when confirm token is not found', async () => {
      deps.subscriptionRepository.findByConfirmToken.mockResolvedValue(null);

      await expect(
        service.confirmSubscription('bad-token'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('unsubscribe()', () => {
    it('deletes the subscription for a valid unsub token', async () => {
      const subscription = buildSubscription({ status: 'confirmed' });
      deps.subscriptionRepository.findByUnsubToken.mockResolvedValue(
        subscription,
      );

      await service.unsubscribe('unsub-tok');

      expect(deps.subscriptionRepository.delete).toHaveBeenCalledWith(
        subscription.id,
      );
    });

    it('throws NotFoundError when unsub token is not found', async () => {
      deps.subscriptionRepository.findByUnsubToken.mockResolvedValue(null);

      await expect(service.unsubscribe('bad-token')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('getSubscriptionsByEmail()', () => {
    it('queries the repository with a confirmed-status filter and maps the result to id, email, repository', async () => {
      deps.subscriptionRepository.findAllByEmail.mockResolvedValue([
        {
          id: 's1',
          email: 'user@test.com',
          status: 'confirmed',
          repository: 'owner/repo',
        },
      ]);

      const result = await service.getSubscriptionsByEmail('user@test.com');

      expect(deps.subscriptionRepository.findAllByEmail).toHaveBeenCalledWith(
        'user@test.com',
        { status: 'confirmed' },
      );
      expect(result).toEqual([
        { id: 's1', email: 'user@test.com', repository: 'owner/repo' },
      ]);
    });

    it('returns empty array when there are no confirmed subscriptions', async () => {
      deps.subscriptionRepository.findAllByEmail.mockResolvedValue([]);

      const result = await service.getSubscriptionsByEmail('user@test.com');

      expect(result).toEqual([]);
    });
  });
});
