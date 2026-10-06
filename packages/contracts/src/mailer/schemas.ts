import { z } from 'zod';
import type { ConfirmationEmailEvent, ReleaseEmailEvent } from './types.js';

export const confirmationEmailEventSchema: z.ZodType<ConfirmationEmailEvent> = z.object({
  email: z.string(),
  repoFullName: z.string(),
  confirmToken: z.string(),
  unsubToken: z.string(),
});

export const releaseEmailEventSchema: z.ZodType<ReleaseEmailEvent> = z.object({
  email: z.string(),
  repoFullName: z.string(),
  tagName: z.string(),
  unsubToken: z.string(),
});
