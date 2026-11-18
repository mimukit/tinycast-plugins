// The path check that runs before playback. Pure Node code with no @raycast/api
// import. A list item carries a path from the last scan, so the file can be gone
// or replaced by a symlink to somewhere else by the time the owner presses Enter.
import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import { isSoundName } from "./formats";

/** The fixed sound folder. It is outside the extension support folder, so uninstall keeps it. */
export function soundFolder(home: string = homedir()): string {
  return join(home, "Music", "Tinynoise");
}

/** True when `path` sits below `root`, not at it. Both paths must already be resolved. */
export function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export type PathCheck = { ok: true; path: string } | { ok: false; reason: "missing" | "outside" | "not-a-sound" };

/**
 * Resolves `path` and confirms that it is still a regular file with an allowed
 * extension inside the sound folder `root`, after `realpath` on both.
 */
export function checkSoundPath(root: string, path: string): PathCheck {
  let realRoot: string;
  let real: string;
  try {
    realRoot = realpathSync(root);
    real = realpathSync(path);
  } catch {
    return { ok: false, reason: "missing" };
  }
  if (!isInside(realRoot, real)) return { ok: false, reason: "outside" };
  try {
    if (!statSync(real).isFile() || !isSoundName(real)) return { ok: false, reason: "not-a-sound" };
  } catch {
    return { ok: false, reason: "missing" };
  }
  return { ok: true, path: real };
}
