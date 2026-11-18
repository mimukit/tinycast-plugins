// The tinydrop setup of the shared smoke harness: the fake Raindrop server, the
// "tinydrop" Keychain service with a test token, and a temp supportPath with a
// real SQLite store, seeded through scripts/lib/load-store.mjs.
import { createSmoke, recordingStubs } from "@tinycast/smoke";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadStore } from "../scripts/lib/load-store.mjs";
import { BOOKMARKS, fakeRaindrop } from "./server.mjs";

/**
 * A fresh temp supportPath. `seed: true` fills the store with the fake bookmarks;
 * `seed: { bookmarks, state, collections, opens }` fills it with those rows, `sync_state`
 * entries, collection rows, and one open per ID in `opens`.
 */
async function supportDir({ seed = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "tinydrop-smoke-"));
  if (seed) {
    const store = new SqliteStore({ path: join(dir, DB_FILE) });
    await store.upsertPage(seed === true ? BOOKMARKS : seed.bookmarks);
    if (seed.state) await store.setSyncState(seed.state);
    if (seed.collections) await store.replaceCollections(seed.collections);
    if (seed.tags) await store.replaceTags(seed.tags);
    for (const id of seed.opens ?? []) await store.recordOpen(id);
    for (const row of seed.checks ?? []) await store.saveLinkCheck(row);
    for (const host of seed.ignored ?? []) await store.addIgnoredHost(host);
  }
  return dir;
}

/**
 * `run(commandName, options)` runs one command in a fresh harness. Besides the shared
 * options, tinydrop's take `seed` (see supportDir), `server` (see fakeRaindrop),
 * `clipboard` and `confirmations`.
 */
export const { run, main } = await createSmoke({
  dist: resolve(import.meta.dirname, "../dist"),
  service: "tinydrop",
  keychain: { "test-token": "tok" },
  stubs: (ctx, opts) => ({ "fetch.request": fakeRaindrop(ctx.calls, opts.server, ctx.linkCalls), ...recordingStubs(ctx, opts) }),
  supportPath: supportDir,
});
export const { SqliteStore, DB_FILE } = await loadStore();
