import { z } from 'zod';
import {
  RoutingKey,
  confirmationEmailEventSchema,
  releaseEmailEventSchema,
} from '@github-notifier/contracts/mailer';
import type { Mailer } from '../mail/mailer.js';
import type { Logger } from '../logger.js';
import {
  buildConfirmationEmail,
  buildReleaseEmail,
} from '../mail/templates.js';

export interface HandlerDeps {
  mailer: Mailer;
  appUrl: string;
  log: Logger;
}

export interface HandlerEntry {
  schema: z.ZodTypeAny;
  handle: (event: unknown, deps: HandlerDeps) => Promise<void>;
}

function defineHandler<T>(
  schema: z.ZodType<T>,
  handle: (event: T, deps: HandlerDeps) => Promise<void>,
): HandlerEntry {
  return { schema, handle: handle as HandlerEntry['handle'] };
}

export const handlers = {
  [RoutingKey.ConfirmationEmail]: defineHandler(
    confirmationEmailEventSchema,
    async (event, { mailer, appUrl, log }) => {
      await mailer.sendMail(buildConfirmationEmail(event, appUrl));
      log.info(
        { to: event.email, repo: event.repoFullName },
        'Sent confirmation email',
      );
    },
  ),

  [RoutingKey.ReleaseEmail]: defineHandler(
    releaseEmailEventSchema,
    async (event, { mailer, appUrl, log }) => {
      await mailer.sendMail(buildReleaseEmail(event, appUrl));
      log.info(
        { to: event.email, repo: event.repoFullName, tag: event.tagName },
        'Sent release notification email',
      );
    },
  ),
};
