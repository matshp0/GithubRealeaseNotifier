import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type {
  CancelVerificationRequest,
  CreateVerificationRequest,
  CreateVerificationResponse,
} from '@github-notifier/contracts/verification';
import type { ILogger } from '../../common/interfaces/logger.interface.js';

export interface VerificationClient {
  createVerification(
    req: CreateVerificationRequest,
  ): Promise<CreateVerificationResponse>;
  cancelVerification(req: CancelVerificationRequest): Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    verificationClient: VerificationClient;
  }
}

export interface VerificationClientDeps {
  baseUrl: string;
  log: ILogger;
}

export function createVerificationClient(
  deps: VerificationClientDeps,
): VerificationClient {
  const { baseUrl, log } = deps;
  const endpoint = `${baseUrl}/internal/verifications`;
  const cancelEndpoint = `${endpoint}/cancel`;

  return {
    async createVerification(req) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        const body = await response.text();
        log.error(
          { status: response.status, body },
          'Verification service request failed',
        );
        throw new Error(`Verification service responded ${response.status}`);
      }

      return (await response.json()) as CreateVerificationResponse;
    },

    async cancelVerification(req) {
      const response = await fetch(cancelEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        const body = await response.text();
        log.error(
          { status: response.status, body },
          'Verification cancel request failed',
        );
        throw new Error(`Verification service responded ${response.status}`);
      }
    },
  };
}

export default fp(
  (fastify: FastifyInstance, _opts: object, done: () => void) => {
    const client = createVerificationClient({
      baseUrl: fastify.config.MAIL_VERIFICATION_URL,
      log: fastify.log,
    });
    fastify.decorate('verificationClient', client);
    done();
  },
  { name: 'verificationClient' },
);
