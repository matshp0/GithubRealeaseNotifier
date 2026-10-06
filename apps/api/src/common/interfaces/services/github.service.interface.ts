export interface IGithubService {
  ensureRepoExists(fullName: string): Promise<{ id: string }>;
}
