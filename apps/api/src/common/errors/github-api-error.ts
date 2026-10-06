export interface GitHubApiError {
  status: number;
  response?: { headers?: Record<string, string | undefined> };
}

export function isGitHubApiError(error: unknown): error is GitHubApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>)['status'] === 'number'
  );
}
