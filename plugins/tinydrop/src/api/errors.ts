import { HttpApiError } from "@tinycast/kit";

export { errorMessage } from "@tinycast/kit";

/** An HTTP error from a Raindrop API call. */
export class RaindropApiError extends HttpApiError {
  /** The `X-RateLimit-Reset` header of a 429 reply, so a caller can wait for it. */
  readonly rateLimitReset: string | undefined;

  constructor(status: number, path: string, body: string, rateLimitReset?: string | null) {
    super("Raindrop", status, path, body);
    this.name = "RaindropApiError";
    this.rateLimitReset = rateLimitReset ?? undefined;
  }

  /** Raindrop rejected the token: the UI shows "Token rejected" with an action to Account. */
  get isTokenRejected(): boolean {
    return this.status === 401;
  }

  protected override describe(status: number, path: string, body: string): string {
    if (status === 401) return "Token rejected. Paste a new test token in Account.";
    if (status === 403) return `Raindrop refused ${path}. The feature can need Raindrop Pro.`;
    return super.describe(status, path, body);
  }
}

/**
 * The client refused a bulk call before it went out: a DELETE to Trash (-99, which deletes for good)
 * or to all (0, unsupported), or a call with no `ids`, too many `ids`, or a `search`. Nothing changed.
 */
export class BulkGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkGuardError";
  }
}

/** True when the error means the token is no longer valid. */
export function isTokenRejected(error: unknown): boolean {
  return error instanceof RaindropApiError && error.isTokenRejected;
}
