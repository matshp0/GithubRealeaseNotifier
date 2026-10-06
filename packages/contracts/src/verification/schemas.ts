import { z } from 'zod';
import type {
  CancelVerificationRequest,
  CreateVerificationRequest,
  CreateVerificationResponse,
} from './types.js';

export const createVerificationRequestSchema: z.ZodType<CreateVerificationRequest> =
  z.object({
    email: z.string(),
    repoFullName: z.string(),
    unsubToken: z.string(),
  });

export const createVerificationResponseSchema: z.ZodType<CreateVerificationResponse> =
  z.object({
    token: z.string(),
  });

export const cancelVerificationRequestSchema: z.ZodType<CancelVerificationRequest> =
  z.object({
    token: z.string(),
  });
