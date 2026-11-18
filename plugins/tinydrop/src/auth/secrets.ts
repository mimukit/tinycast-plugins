// One account, `test-token`, under the service `tinydrop`. The Keychain calls
// live in @tinycast/kit; this file names the service and the account.
import { createKeychain } from "@tinycast/kit";

export const KEYCHAIN_SERVICE = "tinydrop";
export const TOKEN_ACCOUNT = "test-token";

const keychain = createKeychain({ service: KEYCHAIN_SERVICE });

export interface Auth {
  token?: string;
}

export async function getAuth(): Promise<Auth> {
  return { token: keychain.read(TOKEN_ACCOUNT) };
}

export async function saveToken(token: string): Promise<void> {
  keychain.write(TOKEN_ACCOUNT, token.trim());
}

/** Removes the stored token. */
export async function deleteToken(): Promise<void> {
  keychain.remove(TOKEN_ACCOUNT);
}
