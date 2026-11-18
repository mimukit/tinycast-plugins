// Two accounts, `api-token` and `v2-cookie`, under the service `tinytick`. The
// Keychain calls live in @tinycast/kit; this file names the service and the accounts.
import { addCommand as kitAddCommand, createKeychain } from "@tinycast/kit";

export const KEYCHAIN_SERVICE = "tinytick";
export const TOKEN_ACCOUNT = "api-token";
export const COOKIE_ACCOUNT = "v2-cookie";

const keychain = createKeychain({ service: KEYCHAIN_SERVICE });

export interface Auth {
  token?: string;
  v2Cookie?: string;
}

/** The `security -i` line that adds or replaces one tinytick secret. */
export function addCommand(account: string, secret: string): string {
  return kitAddCommand(KEYCHAIN_SERVICE, account, secret);
}

export async function getAuth(): Promise<Auth> {
  return { token: keychain.read(TOKEN_ACCOUNT), v2Cookie: keychain.read(COOKIE_ACCOUNT) };
}

export async function saveApiToken(token: string): Promise<void> {
  keychain.write(TOKEN_ACCOUNT, token.trim());
}

/** Saves the v2 session cookie, or removes it when the value is empty. */
export async function saveV2Cookie(cookie: string | undefined): Promise<void> {
  const value = cookie?.trim();
  if (value) keychain.write(COOKIE_ACCOUNT, value);
  else keychain.remove(COOKIE_ACCOUNT);
}

/** Removes every stored secret. */
export async function signOut(): Promise<void> {
  keychain.remove(TOKEN_ACCOUNT);
  keychain.remove(COOKIE_ACCOUNT);
}
