// Every secret goes to the macOS login Keychain as a generic password, through
// /usr/bin/security. Tinycast keeps preferences, LocalStorage and Cache as
// plaintext JSON, so no secret goes there.
//
// Writes send the secret on stdin to `security -i`, so it never shows in the
// process list. Reads use `find-generic-password -w`, which prints only the secret.
//
// This file uses only erasable TypeScript, so the smoke harness can import
// SECURITY from it with plain Node.
import { spawnSync } from "node:child_process";

export const SECURITY = "/usr/bin/security";
/** The exit code of `security` when no item matches. */
const NOT_FOUND = 44;

export interface Keychain {
  /** The secret stored for `account`, or undefined when there is none. */
  read(account: string): string | undefined;
  /** Adds or replaces the secret for `account`, then reads it back. */
  write(account: string, secret: string): void;
  /** Removes the secret for `account`. No item is not an error. */
  remove(account: string): void;
}

function security(args: string[], input?: string): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(SECURITY, args, { input, encoding: "utf8", timeout: 10_000 });
  if (result.error) throw new Error(`Could not run ${SECURITY}: ${result.error.message}`);
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** Quotes a value for one line of `security -i`, which splits on spaces and reads \" and \\. */
export function quoteArg(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/** The `security -i` line that adds or replaces one secret. */
export function addCommand(service: string, account: string, secret: string): string {
  return `add-generic-password -U -s ${quoteArg(service)} -a ${quoteArg(account)} -w ${quoteArg(secret)}\n`;
}

/** The Keychain items of one plugin: each account under the one `service`. */
export function createKeychain({ service }: { service: string }): Keychain {
  function read(account: string): string | undefined {
    const r = security(["find-generic-password", "-s", service, "-a", account, "-w"]);
    if (r.status === NOT_FOUND) return undefined;
    if (r.status !== 0) throw new Error(`Could not read the Keychain (${r.status}): ${r.stderr.trim()}`);
    return r.stdout.replace(/\n$/, "") || undefined;
  }

  function write(account: string, secret: string): void {
    // A control character would end the `security -i` line, and `-w` prints such a secret as hex.
    if (/[\u0000-\u001f\u007f]/.test(secret)) throw new Error("The secret has a control character. Paste it again.");
    const r = security(["-i"], addCommand(service, account, secret));
    // `security -i` can exit 0 after a failed command, so read the item back.
    if (r.status !== 0 || read(account) !== secret) {
      throw new Error(`Could not save to the Keychain: ${r.stderr.trim() || "the stored value does not match"}`);
    }
  }

  function remove(account: string): void {
    const r = security(["delete-generic-password", "-s", service, "-a", account]);
    if (r.status !== 0 && r.status !== NOT_FOUND) throw new Error(`Could not delete from the Keychain (${r.status}): ${r.stderr.trim()}`);
  }

  return { read, write, remove };
}
