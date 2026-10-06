import { Kysely } from 'kysely';
import { DB } from '@/plugins/infrastructure/database/types.ts';

export async function truncateTables(db: Kysely<DB>) {
  await db.deleteFrom('subscriptions').execute();
  await db.deleteFrom('repositories').execute();
}
