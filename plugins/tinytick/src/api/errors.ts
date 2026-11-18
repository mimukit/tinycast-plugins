import { HttpApiError } from "@tinycast/kit";

export { errorMessage } from "@tinycast/kit";

/** An HTTP error from a TickTick API call. */
export class TickTickApiError extends HttpApiError {
  constructor(status: number, path: string, body: string) {
    super("TickTick", status, path, body);
    this.name = "TickTickApiError";
  }

  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }

  protected override describe(status: number, path: string, body: string): string {
    if (status === 401 || status === 403) return "TickTick rejected the login. Sign in again from the Account command.";
    return super.describe(status, path, body);
  }
}
