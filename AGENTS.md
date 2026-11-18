# AGENTS.md

## Project

tinycast-plugins holds the extensions for the [Tinycast](https://github.com/abue-ammar/tinycast) launcher in one Turborepo with pnpm workspaces. Each plugin lives in `plugins/<name>/` and keeps its own `AGENTS.md` with the rules for that plugin. Shared code goes in `packages/<name>/`. Repo-wide plans live in `docs/plans/`; each plugin keeps its own `docs/` folder.

- `plugins/tinydrop/`: a Raindrop.io extension. See [plugins/tinydrop/AGENTS.md](plugins/tinydrop/AGENTS.md).
- `plugins/tinytick/`: a TickTick extension. See [plugins/tinytick/AGENTS.md](plugins/tinytick/AGENTS.md).

## Build and test

Run these from the repo root.

- `pnpm install`
- `pnpm turbo run typecheck test build` runs the three tasks in every workspace package. `build` writes each plugin's `dist/` and prints the bundle sizes.
- `pnpm --filter <name> <script>` runs one script in one plugin, for example `pnpm --filter tinydrop test`.
- `TINYCAST_DIR=<tinycast-checkout> pnpm turbo run smoke` builds each plugin, then runs its bundles in Tinycast's JS runtime against a fake server. The smoke script takes the checkout from its first argument (`pnpm --filter tinytick smoke <path>`), else `TINYCAST_DIR`, else `../tinycast` beside the repo root. `ONLY`, `VERBOSE` and `TREE` pass through Turbo to the smoke script. The harness is `@tinycast/smoke` in `packages/smoke`; each plugin keeps its fake server, seed data and `flow*` functions in `plugins/<name>/smoke/`, with `smoke/index.mjs` as the entry file.
- `build`, `typecheck` and `test` are cached in `.turbo/`. `smoke`, `build:install`, `probe` and `bench` always run. Each of the three cached tasks depends on `transit`, a task with no script, so the files of each package in `packages/` go into the hash of each plugin task that uses it. Without it, an edit in `packages/` leaves a stale cache hit.

## Rules for agents

- Use pnpm only. Do not commit a lockfile from another package manager. The repo has one `pnpm-lock.yaml`, at the root.
- Do not add the Raycast CLI (`ray`) or `@raycast/utils`. Each plugin builds with the `tinycast-build` bin from `packages/build`.
- Never store a secret in a preference, `LocalStorage` or `Cache`. Tinycast keeps those as plaintext JSON. Secrets go to the Keychain through `createKeychain({ service })` from `@tinycast/kit`. Each plugin's `src/auth/secrets.ts` names its own service and accounts; only `packages/kit/` runs the macOS `security` tool.
- Shared runtime code lives in `@tinycast/kit` (`packages/kit`): the Keychain, the `WriteQueue`, the base `HttpApiError` and `errorMessage()`. Its UI parts, such as the `Picker` screen, live in `@tinycast/kit/ui`. Only `packages/kit/src/ui/` may import `@raycast/api`, so Vitest runs the rest of the kit in Node. A plugin API error extends `HttpApiError`.
- `bash scripts/check-copies.sh` prints each file or line that copies shared code into a plugin and exits 1 on a match. Keep it clean.
- Keep each command bundle under 300 KB. `pnpm turbo run build` prints the sizes.
- CI (`.github/workflows/ci.yml`) runs on each push to `main` and each PR. The `gate` job runs `pnpm install --frozen-lockfile`, `sqlite3 --version`, `pnpm turbo run typecheck test build` and `bash scripts/check-copies.sh`; the `smoke` job runs `pnpm turbo run smoke` against Tinycast at the commit in `TINYCAST_SHA`. On a PR both jobs filter to `--filter=...[origin/main]`. The owner changes the Tinycast pin by hand in a PR.

## Worktree setup

setup:
```sh
cp "$GITKIT_REPO/plugins/tinydrop/.env" plugins/tinydrop/.env
chmod 600 plugins/tinydrop/.env
if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; fi
```

update:
```sh
if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; fi
```

`plugins/tinydrop/.env` holds `RAINDROP_TOKEN` and stays ignored. Never print it or commit it.

## Docs artifact naming

- An artifact under `docs/<type>/` (a plan, a QA plan, a review, research) is named `NNNN-<type>-<slug>-YYYY-MM-DD.md`. This holds for the root `docs/` and for each plugin's `docs/`.
- `NNNN` is a four-digit serial, per directory, assigned in creation order and never reused. To get it, take the highest serial in that directory across this worktree, every other worktree that `git worktree list` names, and `origin/HEAD` (`git ls-tree --name-only origin/HEAD <dir>` after `git fetch origin`), and add one. Scan all three, because parallel worktrees otherwise take the same serial. Skip a source that fails, such as no remote, and without git list the directory only. An empty directory starts at `0001`.
- `YYYY-MM-DD` is the creation date. The whole name stays fixed after edits.
- An ADR uses its decision number as the serial: `docs/adr/NNNN-adr-<slug>-YYYY-MM-DD.md`.
- Reader-facing pages (`docs/wiki/`, how-to guides, runbooks) stay unnumbered.
