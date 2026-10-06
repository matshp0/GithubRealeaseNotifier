import { describe, it, expect } from 'vitest';
import {
  buildConfirmationEmail,
  buildReleaseEmail,
} from '../src/mail/templates.ts';

const APP_URL = 'https://notifier.test';

describe('buildConfirmationEmail', () => {
  it('addresses the subscriber and includes confirm + unsub URLs', () => {
    const message = buildConfirmationEmail(
      {
        email: 'user@test.com',
        repoFullName: 'owner/repo',
        confirmToken: 'confirm-tok',
        unsubToken: 'unsub-tok',
      },
      APP_URL,
    );

    expect(message.to).toBe('user@test.com');
    expect(message.subject).toContain('owner/repo');
    expect(message.text).toContain(`${APP_URL}/api/confirm/confirm-tok`);
    expect(message.text).toContain(`${APP_URL}/api/unsubscribe/unsub-tok`);
    expect(message.html).toContain(`${APP_URL}/api/confirm/confirm-tok`);
    expect(message.html).toContain(`${APP_URL}/api/unsubscribe/unsub-tok`);
  });
});

describe('buildReleaseEmail', () => {
  it('addresses the subscriber and includes release + unsub URLs', () => {
    const message = buildReleaseEmail(
      {
        email: 'user@test.com',
        repoFullName: 'owner/repo',
        tagName: 'v2.0.0',
        unsubToken: 'unsub-tok',
      },
      APP_URL,
    );

    expect(message.to).toBe('user@test.com');
    expect(message.subject).toContain('v2.0.0');
    expect(message.text).toContain(
      'https://github.com/owner/repo/releases/tag/v2.0.0',
    );
    expect(message.text).toContain(`${APP_URL}/api/unsubscribe/unsub-tok`);
    expect(message.html).toContain(`${APP_URL}/api/unsubscribe/unsub-tok`);
  });
});
