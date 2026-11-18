// The smoke harness both plugins share: it drives a plugin's built bundles
// through Tinycast's own JavaScript runtime (the Raycast shim and React
// reconciler Tinycast ships). Each plugin passes its fake server, its seed data
// and its flow* functions; see plugins/<name>/smoke/.
//
// The Tinycast checkout is the first CLI argument, else TINYCAST_DIR, else
// ../tinycast beside the repo root. /usr/bin/security is answered from memory,
// so a run never touches a Keychain (and works on Linux, which has none). The
// Swift renderer is not covered.
//
// ONLY=<flowName> runs one flow, VERBOSE=1 prints the runtime log, the calls and
// the toasts, TREE=1 prints the last tree of each run.
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Tinycast checkout ──────────────────────────────────────────────

/** The repo root: the first folder up from this package with pnpm-workspace.yaml. */
export function repoRoot() {
  for (let dir = import.meta.dirname; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    if (dirname(dir) === dir) return resolve(import.meta.dirname, "../../..");
  }
}

/** The Tinycast checkout: the first CLI argument, else TINYCAST_DIR, else ../tinycast beside the repo root. */
export function tinycastDir() {
  return resolve(process.argv[2] ?? process.env.TINYCAST_DIR ?? resolve(repoRoot(), "../tinycast"));
}

// ─── Fake Keychain ──────────────────────────────────────────────────

/** Reads one `"…"` argument of a `security -i` line, as secrets.ts quotes it. */
function unquote(line, flag) {
  const m = line.match(new RegExp(`${flag} "((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1].replace(/\\(.)/g, "$1") : undefined;
}

/**
 * Answers /usr/bin/security from memory, with `items` as the accounts of the Keychain
 * `service`. child_process.spawnSync is a sync host call (proc.run), which the harness's
 * async stubs do not cover, so this wraps invokeSync. Everything else, sqlite3 included,
 * runs for real.
 */
export function fakeKeychain(harness, items, { service }) {
  const host = harness.context.__tinycastHost;
  const invokeSync = host.invokeSync.bind(host);
  const b64 = (s) => Buffer.from(s).toString("base64");
  host.invokeSync = (api, method, argsJson) => {
    const spec = JSON.parse(argsJson)[0];
    if (api !== "proc" || method !== "run" || spec?.command !== "/usr/bin/security") return invokeSync(api, method, argsJson);
    const [verb, ...rest] = spec.args;
    const account = rest[rest.indexOf("-a") + 1];
    let status = 0, stdout = "";
    if (verb === "find-generic-password") {
      if (items[account] === undefined) status = 44;
      else stdout = `${items[account]}\n`;
    } else if (verb === "delete-generic-password") {
      if (items[account] === undefined) status = 44;
      delete items[account];
    } else if (verb === "-i" && spec.input) {
      const line = Buffer.from(spec.input, "base64").toString();
      const a = unquote(line, "-a"), w = unquote(line, "-w");
      if (line.startsWith("add-generic-password") && unquote(line, "-s") === service && a && w !== undefined) items[a] = w;
      else status = 1;
    } else {
      status = 1;
    }
    return JSON.stringify({ ok: true, value: { stdout: b64(stdout), stderr: "", status } });
  };
}

// ─── Stubs ──────────────────────────────────────────────────────────

/**
 * Host stubs that record toasts, HUDs, alerts, opens and copies into `ctx`, and keep
 * LocalStorage in `ctx.storage`. `clipboard` is the clipboard text, `confirmations` the
 * answers to confirmAlert in order (true once they run out). The plugin adds "fetch.request".
 */
export function recordingStubs(ctx, { clipboard = "", confirmations = [] } = {}) {
  return {
    "feedback.showToast": (a) => { ctx.toasts.push(a[0]); return `toast-${ctx.toasts.length}`; },
    "feedback.showHUD": (a) => { ctx.toasts.push({ hud: a[0] }); return null; },
    "feedback.updateToast": (a) => { ctx.updates.push(a[1]); return null; },
    "feedback.hideToast": () => null,
    "feedback.confirmAlert": (a) => { ctx.alerts.push(a[0]); return confirmations.shift() ?? true; },
    "storage.get": (a) => ctx.storage[a[0]] ?? null,
    "storage.set": (a) => { ctx.storage[a[0]] = a[1]; return null; },
    "storage.remove": (a) => { delete ctx.storage[a[0]]; return null; },
    "system.open": (a) => { ctx.opened.push(a[0]); return null; },
    "clipboard.copy": (a) => { ctx.copied.push(a[0]); return null; },
    "clipboard.readText": () => clipboard,
  };
}

// ─── Harness ────────────────────────────────────────────────────────

/**
 * Checks the Tinycast checkout and the plugin's dist/, imports the runtime harness, and
 * returns `run()` and `main()` for the plugin. The options:
 *
 * - `dist`: the plugin's dist/ folder.
 * - `service`: the plugin's Keychain service; fakeKeychain writes only to it.
 * - `keychain`: the Keychain accounts a run starts with, unless the run passes `keychain`.
 * - `stubs(ctx, opts)`: the host stubs of a run, "fetch.request" included.
 * - `supportPath(opts)`: an async function that returns a fresh supportPath, or none.
 * - `caches`: the boot caches, or none.
 * - `settle`: the ms a run waits after start; `wait`: the ms a press waits by default.
 * - `flowLines`: print a ✓ or ✗ line after each flow.
 */
export async function createSmoke({ dist, service, keychain: startKeychain = {}, stubs, supportPath, caches, settle = 900, wait = 500, flowLines = true }) {
  const dir = tinycastDir();
  const harnessPath = join(dir, "Scripts/raycast-runtime/test.mjs");
  if (!existsSync(harnessPath)) {
    console.error(`No Tinycast checkout at ${dir}. Pass its path: pnpm smoke <path>`);
    process.exit(1);
  }
  if (!existsSync(join(dist, "package.json"))) {
    console.error("No dist/. Run pnpm build first.");
    process.exit(1);
  }
  const { createHarness, bootConfig, describeTree, preferenceDefault } = await import(pathToFileURL(harnessPath).href);
  const manifest = JSON.parse(readFileSync(join(dist, "package.json"), "utf8"));
  const tempDirs = [];

  /**
   * Runs one command in a fresh harness. `keychain` is the starting Keychain,
   * `preferences` override the manifest defaults, `storage` seeds LocalStorage,
   * `interact` drives the screen. Other options go to `stubs` and `supportPath`.
   * Returns the failure count.
   */
  async function run(commandName, opts = {}) {
    const { args = {}, keychain = { ...startKeychain }, preferences = {}, storage = {}, interact } = opts;
    const cmd = manifest.commands.find((c) => c.name === commandName);
    assert.ok(cmd, `command ${commandName} is in the manifest`);
    const support = supportPath ? await supportPath(opts) : undefined;
    if (support) tempDirs.push(support);
    const ctx = {
      harness: undefined, calls: [], linkCalls: [], toasts: [], updates: [], alerts: [], opened: [], copied: [],
      storage: { ...storage }, keychain, supportPath: support, wait, tree: () => ctx.harness.state.trees.at(-1),
    };
    const harness = createHarness({ verbose: !!process.env.VERBOSE, stubs: stubs(ctx, opts) });
    ctx.harness = harness;
    fakeKeychain(harness, keychain, { service });
    harness.boot(bootConfig({
      environment: {
        ...bootConfig().environment, extensionName: manifest.name, commandName, commandMode: cmd.mode, assetsPath: join(dist, "assets"),
        ...(support ? { supportPath: support } : {}),
      },
      preferences: { ...Object.fromEntries((manifest.preferences ?? []).map((p) => [p.name, preferenceDefault(p)])), ...preferences },
      ...(caches ? { caches } : {}),
      launchProps: { arguments: args },
    }));
    const file = join(dist, `${commandName}.js`);
    harness.start("s1", readFileSync(file, "utf8"), file, dist, cmd.mode === "view" ? "view" : cmd.mode === "menu-bar" ? "menu-bar" : "no-view", { launchProps: { arguments: args } });
    await sleep(settle);
    console.log(`\n=== ${commandName} ===`);
    if (harness.state.failures.length) console.log("FAILURES:", harness.state.failures);
    let failed = harness.state.failures.length;
    if (interact) {
      try {
        await interact(ctx);
        if (harness.state.failures.length > failed) throw new Error(`runtime failure: ${harness.state.failures.slice(failed).join("; ")}`);
      } catch (error) {
        console.log(`✗ ${error.message}`);
        failed += 1;
      }
    }
    const last = ctx.tree();
    if (last && process.env.TREE) console.log(describeTree(last));
    if (process.env.VERBOSE) console.log("calls:", ctx.calls, "toasts:", ctx.toasts);
    harness.stop("s1");
    return failed;
  }

  /** Runs the flows in order, or only the one `ONLY=flowName` names, then exits 1 on any failure. */
  async function main(flows) {
    const only = process.env.ONLY;
    const selected = only ? flows.filter((f) => f.name === only) : flows;
    let failures = 0;
    try {
      for (const flow of selected) {
        const failed = await flow();
        if (flowLines) console.log(`${failed ? "✗" : "✓"} ${flow.name}`);
        failures += failed;
      }
    } finally {
      for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
    }
    console.log(failures ? `\n✗ ${failures} failure(s)` : "\n✓ smoke passed");
    process.exit(failures ? 1 : 0);
  }

  return { run, main, manifest };
}

// ─── Tree helpers ───────────────────────────────────────────────────

export function findAll(node, pred, out = []) {
  if (!node || typeof node !== "object") return out;
  if (pred(node)) out.push(node);
  for (const c of node.children ?? []) findAll(c, pred, out);
  for (const v of Object.values(node.props ?? {})) if (v && typeof v === "object" && v.type) findAll(v, pred, out);
  return out;
}

/** The first action with this title that has an onAction handler. */
export const actionNamed = (tree, title) => findAll(tree, (n) => n.props?.title === title && n.props?.onAction?.$fn)[0];

export const rowTitles = (ctx) => findAll(ctx.tree(), (n) => n.type === "List.Item").map((n) => n.props.title);

/** The List.Item with this title. */
export const itemTitled = (ctx, title) => findAll(ctx.tree(), (n) => n.type === "List.Item" && n.props.title === title)[0];

export async function press(ctx, title, wait = ctx.wait) {
  const a = actionNamed(ctx.tree(), title);
  assert.ok(a, `action "${title}" exists`);
  ctx.harness.dispatch("s1", a.props.onAction.$fn, []);
  await sleep(wait);
}

/** Presses an action of the List.Item with this title. */
export async function pressIn(ctx, rowTitle, actionTitle, wait = ctx.wait) {
  const item = itemTitled(ctx, rowTitle);
  assert.ok(item, `a row titled "${rowTitle}": ${rowTitles(ctx)}`);
  const a = findAll(item, (n) => n.props?.title === actionTitle && n.props?.onAction?.$fn)[0];
  assert.ok(a, `row "${rowTitle}" has action "${actionTitle}"`);
  ctx.harness.dispatch("s1", a.props.onAction.$fn, []);
  await sleep(wait);
}

/** The action on the last row with this title, from the row's action panel, so a test does not depend on row order. */
export async function pressOn(ctx, row, title, wait = ctx.wait) {
  const item = findAll(ctx.tree(), (n) => n.type === "List.Item" && n.props?.title === row).at(-1);
  assert.ok(item, `row "${row}" exists`);
  const a = actionNamed(item.props.actions, title);
  assert.ok(a, `action "${title}" exists on "${row}"`);
  ctx.harness.dispatch("s1", a.props.onAction.$fn, []);
  await sleep(wait);
}

/** Presses the action whose title starts with `prefix`, such as "Undo". */
export async function pressPrefix(ctx, prefix, wait = 300) {
  const a = findAll(ctx.tree(), (n) => typeof n.props?.title === "string" && n.props.title.startsWith(prefix) && n.props?.onAction?.$fn)[0];
  assert.ok(a, `an action starting with "${prefix}"`);
  ctx.harness.dispatch("s1", a.props.onAction.$fn, []);
  await sleep(wait);
}

/** Chooses a value in the open picker's dropdown, as Tinycast does when you press ↵ on an item. */
export async function choose(ctx, value, wait = ctx.wait) {
  const field = findAll(ctx.tree(), (n) => n.type === "Form.Dropdown").at(-1);
  assert.ok(field, "a picker dropdown is open");
  const values = findAll(field, (n) => n.type === "Form.Dropdown.Item").map((n) => n.props.value);
  assert.ok(values.includes(value), `picker offers "${value}": ${values}`);
  ctx.harness.dispatch("s1", field.props.onTinycastChange.$fn, [value]);
  await sleep(wait);
  const screens = ctx.tree().children ?? [];
  assert.equal(screens.length, 1, `the picker closes after a choice: ${screens.length} screens`);
}

export async function typeSearch(ctx, text, wait = ctx.wait) {
  const list = findAll(ctx.tree(), (n) => n.type === "List" && n.props?.onSearchTextChange?.$fn).at(-1);
  assert.ok(list, "a search bar exists");
  ctx.harness.dispatch("s1", list.props.onSearchTextChange.$fn, [text]);
  await sleep(wait);
}

export async function setField(ctx, type, id, value) {
  const field = findAll(ctx.tree(), (n) => n.type === type && n.props?.id === id).at(-1);
  assert.ok(field, `${type} "${id}" exists`);
  ctx.harness.dispatch("s1", field.props.onTinycastChange.$fn, [value]);
  await sleep(100);
}

/** Polls until `pred()` is true; the pacer spaces API calls 500 ms apart, so a sync takes seconds. */
export async function waitFor(pred, what, ms = 15_000) {
  const end = Date.now() + ms;
  while (!pred()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

/** Runs a toast's action, as Tinycast does when you press it. */
export function runToastAction(ctx, action) {
  assert.ok(action?.token, "the toast action has a token");
  ctx.harness.call(`__tinycast.runToastAction(${JSON.stringify(action.token)})`);
}

/** Picks a value in the search bar's dropdown by its title. */
export async function pickDropdown(ctx, title, wait = ctx.wait) {
  const dropdown = findAll(ctx.tree(), (n) => n.type === "List.Dropdown").at(-1);
  assert.ok(dropdown, "a collection dropdown exists");
  const item = findAll(dropdown, (n) => n.type === "List.Dropdown.Item" && n.props.title === title)[0];
  assert.ok(item, `the dropdown has "${title}"`);
  ctx.harness.dispatch("s1", dropdown.props.onChange.$fn, [item.props.value]);
  await sleep(wait);
}
