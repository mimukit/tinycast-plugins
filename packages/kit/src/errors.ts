/**
 * An HTTP error from a vendor API call. The base writes the message for 404, 429 and every
 * other status. A subclass handles 401 and 403 in its own `describe()`, then calls this one.
 */
export class HttpApiError extends Error {
  readonly vendor: string;
  readonly status: number;
  readonly path: string;
  readonly body: string;

  constructor(vendor: string, status: number, path: string, body: string) {
    super();
    this.name = "HttpApiError";
    this.vendor = vendor;
    this.status = status;
    this.path = path;
    this.body = body;
    this.message = this.describe(status, path, body);
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }

  /** The message for this error. The constructor calls it once, before a subclass sets its own fields. */
  protected describe(status: number, path: string, body: string): string {
    if (status === 404) return `Not found: ${path}`;
    if (status === 429) return `${this.vendor} rate limit. Try again in a minute.`;
    const detail = body.slice(0, 200).trim();
    return `${this.vendor} error ${status} on ${path}${detail ? `: ${detail}` : ""}`;
  }
}

/** A readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
