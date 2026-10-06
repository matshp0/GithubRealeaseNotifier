export interface ISubscriptionRepository {
  create(data: {
    email: string;
    repositoryId: string;
  }): Promise<{ id: string; confirmToken: string; unsubToken: string }>;
  updateById(
    id: string,
    data: {
      status?: 'confirmed' | 'awaiting_confirmation';
      confirmToken?: string;
    },
  ): Promise<unknown>;
  findByConfirmToken(
    token: string,
  ): Promise<{ id: string; email: string } | null>;
  findByUnsubToken(
    token: string,
  ): Promise<{ id: string; email: string } | null>;
  findAllByEmail(
    email: string,
    filter: { status?: 'confirmed' | 'pending' | 'unsubscribed' },
  ): Promise<Array<{ id: string; email: string; repository: string }>>;
  delete(id: string): Promise<unknown>;
}
