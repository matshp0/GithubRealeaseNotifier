export interface CreateVerificationRequest {
  email: string;
  repoFullName: string;
  unsubToken: string;
}

export interface CreateVerificationResponse {
  token: string;
}

export interface CancelVerificationRequest {
  token: string;
}
