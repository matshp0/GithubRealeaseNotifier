import type {
  ConfirmationEmailEvent,
  ReleaseEmailEvent,
} from '@github-notifier/contracts/mailer';

const FROM = 'GitHub Notifier <noreply@github-notifier.local>';

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function buildConfirmationEmail(
  event: ConfirmationEmailEvent,
  appUrl: string,
): EmailMessage {
  const { email, repoFullName, confirmToken, unsubToken } = event;
  const confirmUrl = `${appUrl}/api/confirm/${confirmToken}`;
  const unsubUrl = `${appUrl}/api/unsubscribe/${unsubToken}`;

  return {
    from: FROM,
    to: email,
    subject: `Confirm your subscription to ${repoFullName}`,
    text: `Click the link to confirm your subscription:\n\n${confirmUrl}\n\nUnsubscribe: ${unsubUrl}`,
    html: `<p>Click the link to confirm your subscription to <strong>${repoFullName}</strong>:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p><a href="${unsubUrl}">Unsubscribe</a></p>`,
  };
}

export function buildReleaseEmail(
  event: ReleaseEmailEvent,
  appUrl: string,
): EmailMessage {
  const { email, repoFullName, tagName, unsubToken } = event;
  const releaseUrl = `https://github.com/${repoFullName}/releases/tag/${tagName}`;
  const unsubUrl = `${appUrl}/api/unsubscribe/${unsubToken}`;

  return {
    from: FROM,
    to: email,
    subject: `New release: ${repoFullName} ${tagName}`,
    text: `${repoFullName} released ${tagName}.\n\nView release: ${releaseUrl}\n\nUnsubscribe: ${unsubUrl}`,
    html: `<p><strong>${repoFullName}</strong> released <strong>${tagName}</strong>.</p><p><a href="${releaseUrl}">View release</a></p><p><a href="${unsubUrl}">Unsubscribe</a></p>`,
  };
}
