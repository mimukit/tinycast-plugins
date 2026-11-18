// The play-time check: the path check from src/sounds/path.ts, then `afinfo`,
// which reads the file header. A file that fails either check does not start
// the loop. Pure Node code with no @raycast/api import.
import { execFileSync } from "node:child_process";
import { checkSoundPath } from "../sounds/path";

export const AFINFO = "/usr/bin/afinfo";

/** True when `afinfo` reads the file. A corrupt or non-audio file makes it exit non-zero. */
export function afinfoAccepts(file: string, afinfo: string = AFINFO): boolean {
  try {
    execFileSync(afinfo, [file], { stdio: "ignore", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

export type Playable = { ok: true; path: string } | { ok: false; message: string };

/** Checks `file` against the sound folder `root`, then with `afinfo`. */
export function checkPlayable(root: string, file: string, accepts: (file: string) => boolean = afinfoAccepts): Playable {
  const check = checkSoundPath(root, file);
  if (!check.ok) {
    const message = {
      missing: "The file is gone. Refresh the list.",
      outside: "The file is outside the sound folder.",
      "not-a-sound": "The file is not a supported sound.",
    }[check.reason];
    return { ok: false, message };
  }
  if (!accepts(check.path)) return { ok: false, message: "afinfo cannot read this file. It may be corrupt." };
  return check;
}
