// The tinynoise setup of the shared smoke harness: a temp home folder with an
// optional seeded ~/Music/Tinynoise, and a temp supportPath with optional
// session, last-sound and failure records.
import { createSmoke, recordingStubs } from "@tinycast/smoke";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

/** The sound folder inside a smoke home folder. */
export const soundsIn = (home) => join(home, "Music", "Tinynoise");

/**
 * A fresh home folder. `sounds` is a list of paths relative to ~/Music/Tinynoise
 * to create, with fake content. A flow that needs the paths before the run calls
 * this itself and passes the result as `home`.
 */
export function makeHome(sounds = []) {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "tinynoise-home-")));
  for (const rel of sounds) {
    const file = join(soundsIn(home), rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "not audio");
  }
  return home;
}

async function homeDir({ home, sounds } = {}) {
  return home ?? makeHome(sounds);
}

/** A fresh supportPath. `records` maps a file name (session.json, failure.json) to its JSON value. */
async function supportDir({ records } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "tinynoise-support-"));
  for (const [name, value] of Object.entries(records ?? {})) writeFileSync(join(dir, name), JSON.stringify(value));
  return dir;
}

/** `run(commandName, options)` runs one command in a fresh harness. tinynoise's options are `home`, `sounds` and `records`. */
export const { run, main } = await createSmoke({
  dist: resolve(import.meta.dirname, "../dist"),
  service: "tinynoise",
  stubs: (ctx, opts) => ({
    ...recordingStubs(ctx, opts),
    "system.showInFinder": (a) => { ctx.opened.push(`finder:${a[0]}`); return null; },
  }),
  supportPath: supportDir,
  home: homeDir,
  settle: 500,
  wait: 300,
});
