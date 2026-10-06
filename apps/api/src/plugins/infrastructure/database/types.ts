import type { ColumnType } from 'kysely';

export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

export type SubscriptionStatus =
  | 'confirmed'
  | 'pending'
  | 'unsubscribed'
  | 'awaiting_confirmation';

export type OutboxEventStatus = 'pending' | 'processed' | 'failed';

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Repositories {
  etag: string | null;
  fullName: string;
  id: Generated<string>;
  lastCheckedAt: Generated<Timestamp | null>;
  lastSeenTag: string | null;
}

export interface Subscriptions {
  confirmToken: Generated<string>;
  email: string;
  id: Generated<string>;
  repositoryId: string;
  status: Generated<SubscriptionStatus>;
  unsubToken: Generated<string>;
}

export interface NotificationOutbox {
  id: Generated<string>;
  routingKey: string;
  payload: unknown;
  status: Generated<OutboxEventStatus>;
  retryCount: Generated<number>;
  createdAt: Generated<Timestamp>;
  processedAt: Timestamp | null;
}

export interface DB {
  repositories: Repositories;
  subscriptions: Subscriptions;
  notificationOutbox: NotificationOutbox;
}
