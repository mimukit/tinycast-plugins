# tinycast-plugins

Extensions for [Tinycast](https://github.com/abue-ammar/tinycast), a launcher for macOS. Each extension lives in `plugins/`, and the code they share lives in `packages/`. The repo is a pnpm workspace driven by Turborepo.

This repo replaces the old [mimukit/tinydrop](https://github.com/mimukit/tinydrop) and [mimukit/tinytick](https://github.com/mimukit/tinytick) repos, which are now archived.

## Plugins

| Plugin | What it does | Commands |
|---|---|---|
| [tinydrop](plugins/tinydrop/README.md) | Searches your [Raindrop.io](https://raindrop.io) bookmarks from a local SQLite index, so search works offline and does not wait on the network. Writes go straight to the Raindrop API. | Search Bookmarks, Add Bookmark, Sync, Clean Up Bookmarks |
| [tinytick](plugins/tinytick/README.md) | Adds and manages [TickTick](https://ticktick.com) tasks from the keyboard, with a one-line syntax such as `call bank tomorrow 3pm !high #admin ~Personal`. The TickTick app does not need to run. | Tasks, Add Task |
| [tinynoise](plugins/tinynoise/README.md) | Plays your own background sounds from `~/Music/Tinynoise` on a loop with `afplay`. Playback keeps going after the launcher closes. | Play Noise, Stop Noise, Toggle Noise |

All three are pre-release and built for personal use. Each plugin README covers its sign-in, keys, search or input syntax, and preferences.

## Requirements

- macOS with Tinycast, and extensions turned on in Tinycast.
- Node 24 and pnpm. The root `package.json` pins the pnpm version in `packageManager`, so `corepack enable` picks the right one.
- `sqlite3` with FTS5 for tinydrop. It uses `/usr/bin/sqlite3`, which ships with macOS. Set `TINYDROP_SQLITE3` to point at another binary. The store tests skip when there is none.

## Install a plugin

```sh
git clone https://github.com/mimukit/tinycast-plugins
cd tinycast-plugins
pnpm install
pnpm --filter tinydrop build
```

Swap `tinydrop` for `tinytick` or `tinynoise` to build another plugin. The build writes `plugins/<name>/dist/`.

In Tinycast, open Settings › Extensions › Install New › Add from folder, and pick `plugins/<name>/dist/`. You only do this once. After that, `pnpm --filter <name> build:install` rebuilds the plugin and copies `dist/` over the installed copy in `~/Library/Application Support/com.abueammar.tinycast/extensions/<name>`. Set `TINYCAST_BUNDLE_ID=com.abueammar.tinycast.dev` to install into a debug build of Tinycast, or `TINYCAST_EXT_DIR` to install into any other folder.

tinydrop and tinytick need an API token. They keep it in your login Keychain, never in Tinycast's preferences, which Tinycast stores as plaintext JSON. See the plugin README for where to get the token.

## Repo layout

```text
plugins/
  tinydrop/        Raindrop.io extension
  tinytick/        TickTick extension
  tinynoise/       background sound extension
packages/
  kit/             @tinycast/kit: Keychain access, write queue, HTTP errors, shared UI such as the Picker screen
  build/           @tinycast/build: the tinycast-build bin that bundles each command with esbuild
  smoke/           @tinycast/smoke: harness that runs built bundles in Tinycast's JS runtime
  config/          @tinycast/config: shared tsconfig and Vitest base config
scripts/
  check-copies.sh  fails when a plugin copies code that belongs in packages/
docs/              repo-wide plans, QA plans and research
```

Each plugin keeps its own `docs/` folder and an `AGENTS.md` with the rules for that plugin.

## Development

Run these from the repo root.

```sh
pnpm install
pnpm turbo run typecheck test build    # every package; build prints the bundle sizes
bash scripts/check-copies.sh           # exits 1 if shared code was copied into a plugin
pnpm --filter tinytick test            # one script in one plugin
```

Turbo caches `build`, `typecheck` and `test` in `.turbo/`. An edit in `packages/` invalidates the cache of every plugin that uses that package.

Each command bundle must stay under 300 KB. `tinycast-build` fails the build when one goes over.

The repo has no Raycast CLI and no `@raycast/utils`. Plugins build with `tinycast-build` from `packages/build`.

### Smoke tests

The smoke tests run the built bundles inside Tinycast's own Raycast shim and React reconciler in Node, against a fake server for each plugin. They catch API and render bugs without a Mac. They do not cover the Swift renderer, the real Keychain or real audio.

```sh
git clone --depth 1 https://github.com/abue-ammar/tinycast ../tinycast
pnpm turbo run smoke
```

The smoke script looks for the Tinycast checkout in its first argument, then `TINYCAST_DIR`, then `../tinycast` next to the repo. To run one flow, name it: `ONLY=flowEndToEnd pnpm --filter tinydrop smoke`. `VERBOSE=1` and `TREE=1` print more of the run. Each plugin keeps its fake server and its `flow*` functions in `plugins/<name>/smoke/`.

### Before a merge

No CI runs on this repo, so run the full check by hand:

```sh
pnpm install --frozen-lockfile
pnpm turbo run typecheck test build
bash scripts/check-copies.sh
TINYCAST_DIR=../tinycast pnpm turbo run smoke
```

### Add a plugin

1. Create `plugins/<name>/` with a `package.json` whose `build` script is `tinycast-build`, like the existing plugins.
2. Add its commands to `plugins/<name>/src/manifest.json`.
3. Depend on `@tinycast/build`, `@tinycast/config` and `@tinycast/smoke` with `workspace:*`. Add `@tinycast/kit` when the plugin needs the Keychain, the write queue or the shared UI.
4. Put secrets in the Keychain through `createKeychain({ service })` from `@tinycast/kit`.
5. Add a `smoke/index.mjs` entry that uses `@tinycast/smoke`.
6. Add the plugin to the table above and to `AGENTS.md`.

## License

MIT. See [LICENSE](LICENSE).
