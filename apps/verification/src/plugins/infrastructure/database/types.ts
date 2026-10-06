import type { ColumnType } from 'kysely';

export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

export type VerificationStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'expired';

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Verifications {
  id: Generated<string>;
  email: string;
  repoFullName: string;
  token: Generated<string>;
  status: Generated<VerificationStatus>;
  createdAt: Generated<Timestamp>;
  confirmedAt: Timestamp | null;
}

export interface DB {
  verifications: Verifications;
}
