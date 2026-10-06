export { isGitHubApiError } from './github-api-error.js';
export type { GitHubApiError } from './github-api-error.js';

export abstract class DomainError extends Error {
  constructor(message: string = '') {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends DomainError {}

export class ConflictError extends DomainError {}

export class AlreadyExistsError extends DomainError {}
