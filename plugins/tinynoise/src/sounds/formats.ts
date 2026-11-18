// The audio formats tinynoise lists. `afinfo` checks each file again at play time.
import { basename, extname } from "node:path";

/** The extensions `afplay` plays, compared in lower case. */
export const SOUND_EXTENSIONS: readonly string[] = [".m4a", ".aac", ".mp3", ".wav", ".aif", ".aiff", ".caf"];

/** True when the name ends in an allowed sound extension, in any case. */
export function isSoundName(name: string): boolean {
  return SOUND_EXTENSIONS.includes(extname(name).toLowerCase());
}

/** The label of a sound file: its name without the extension. */
export function soundLabel(path: string): string {
  return basename(path, extname(path));
}
