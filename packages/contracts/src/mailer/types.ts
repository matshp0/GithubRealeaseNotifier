export const NOTIFICATIONS_EXCHANGE = 'notifications';

export const EMAIL_QUEUE = 'email.notifications';

export const RoutingKey = {
  ConfirmationEmail: 'email.confirmation',
  ReleaseEmail: 'email.release',
} as const;

export type RoutingKey = (typeof RoutingKey)[keyof typeof RoutingKey];

export interface ConfirmationEmailEvent {
  email: string;
  repoFullName: string;
  confirmToken: string;
  unsubToken: string;
}

export interface ReleaseEmailEvent {
  email: string;
  repoFullName: string;
  tagName: string;
  unsubToken: string;
}
