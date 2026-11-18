// The Tinycast side of the playback code: the session in the extension support
// folder and the HUD lines the three commands share.
import { environment } from "@raycast/api";
import { mkdirSync } from "node:fs";
import { LockBusyError, Session } from "../playback/session";
import { soundFolder } from "../sounds/path";

export function openSession(): Session {
  return new Session({ supportPath: environment.supportPath });
}

/** The sound folder, created when it is missing. */
export function ensureSoundFolder(): string {
  const root = soundFolder();
  try {
    mkdirSync(root, { recursive: true });
  } catch {
    // The list shows the empty state; Open Sound Folder names the path.
  }
  return root;
}

/** A short message for an error from the session. */
export function failureMessage(error: unknown): string {
  if (error instanceof LockBusyError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
