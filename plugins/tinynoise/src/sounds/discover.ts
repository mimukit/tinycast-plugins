// Sound discovery: reads the sound folder into list sections. Pure Node code
// with no @raycast/api import, so Vitest runs it against temp folders.
//
// Rules (plan 0002, Discovery and Formats rows): files in the folder root form
// the first section, and each first-level subfolder forms one section named
// after the folder. Deeper levels, hidden entries and unsupported extensions are
// skipped. A symlink counts only when it resolves to a regular file inside the
// sound folder. Items sort by label, case-insensitive. Each item carries the
// resolved absolute path, never the label.
import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { isSoundName } from "./formats";
import { isInside } from "./path";

/** The title of the section that holds the files in the folder root. */
export const ROOT_SECTION_TITLE = "Sounds";

export interface Sound {
  /** The file name without its extension. */
  label: string;
  /** The file name, set only when another sound in the same section has the same label. */
  subtitle?: string;
  /** The resolved absolute path of the file. */
  path: string;
}

export interface SoundSection {
  title: string;
  sounds: Sound[];
}

const byLabel = (a: { label: string; name: string }, b: { label: string; name: string }) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) || a.name.localeCompare(b.name);

/**
 * Reads the sound folder `root` into sections: the root files first (when there
 * are any), then one section per first-level subfolder that holds a sound,
 * sorted by folder name. A missing root gives no sections.
 */
export function discoverSounds(root: string): SoundSection[] {
  let realRoot: string;
  try {
    realRoot = realpathSync(root);
    if (!statSync(realRoot).isDirectory()) return [];
  } catch {
    return [];
  }

  const sections: SoundSection[] = [];
  const rootSounds = readSounds(realRoot, realRoot);
  if (rootSounds.length) sections.push({ title: ROOT_SECTION_TITLE, sounds: rootSounds });

  const folders = entries(realRoot)
    .filter((name) => !name.startsWith(".") && isPlainDirectory(join(realRoot, name)))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }) || a.localeCompare(b));
  for (const name of folders) {
    const sounds = readSounds(join(realRoot, name), realRoot);
    if (sounds.length) sections.push({ title: name, sounds });
  }
  return sections;
}

function entries(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** A real folder, not a symlink to one: a symlink counts only when it resolves to a file. */
function isPlainDirectory(path: string): boolean {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** The sounds directly inside `dir`, each resolved and kept only when it sits inside `realRoot`. */
function readSounds(dir: string, realRoot: string): Sound[] {
  const found: { label: string; name: string; path: string }[] = [];
  for (const name of entries(dir)) {
    if (name.startsWith(".") || !isSoundName(name)) continue;
    const resolved = resolveSoundFile(join(dir, name), realRoot);
    if (resolved) found.push({ label: basename(name, extname(name)), name, path: resolved });
  }
  found.sort(byLabel);

  const counts = new Map<string, number>();
  for (const s of found) counts.set(s.label.toLowerCase(), (counts.get(s.label.toLowerCase()) ?? 0) + 1);
  return found.map((s) => {
    const sound: Sound = { label: s.label, path: s.path };
    if ((counts.get(s.label.toLowerCase()) ?? 0) > 1) sound.subtitle = s.name;
    return sound;
  });
}

/** The real path of a regular sound file inside `realRoot`, or undefined. */
function resolveSoundFile(path: string, realRoot: string): string | undefined {
  try {
    const real = realpathSync(path);
    if (!isInside(realRoot, real) || !isSoundName(real) || !statSync(real).isFile()) return undefined;
    return real;
  } catch {
    return undefined;
  }
}
