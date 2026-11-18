// The tinytick setup of the shared smoke harness: the fake TickTick server, the
// "tinytick" Keychain service with an API token, and the cached snapshot.
import { createSmoke } from "@tinycast/smoke";
import { resolve } from "node:path";
import { fakeServer, snapshot } from "./server.mjs";

/** `run(commandName, options)` runs one command in a fresh harness, with the shared options. */
export const { run, main } = await createSmoke({
  dist: resolve(import.meta.dirname, "../dist"),
  service: "tinytick",
  keychain: { "api-token": "tok" },
  stubs: (ctx) => ({
    "fetch.request": fakeServer(ctx.calls),
    "feedback.showToast": (a) => { ctx.toasts.push(JSON.stringify(a[0]?.title ?? a)); return "toast-1"; },
    "feedback.showHUD": (a) => { ctx.toasts.push(`HUD ${JSON.stringify(a)}`); return null; },
  }),
  caches: { default: { snapshot: JSON.stringify(snapshot) } },
  settle: 700,
  wait: 300,
  flowLines: false,
});
