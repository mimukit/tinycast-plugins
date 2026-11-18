# AGENTS.md

## Project

tinydrop is a Raindrop.io extension for the [Tinycast](https://github.com/abue-ammar/tinycast) launcher. It keeps the bookmarks in a local SQLite database, read through the macOS `/usr/bin/sqlite3`, so search never waits on the network. Writes go straight to the Raindrop REST API. It is a Raycast-format extension: a `package.json` manifest plus one CommonJS bundle per command, with `react`, `react/jsx-runtime` and `@raycast/api` left external. Stack: TypeScript, React, esbuild, Vitest. Package manager: pnpm.

v1 is built and passes the Linux gate; the check in real Tinycast on macOS is issue #2. The v1 plan is [docs/plans/0001-plan-tinydrop-features-2026-11-04.md](docs/plans/0001-plan-tinydrop-features-2026-11-04.md). The build copies its tooling from [tinytick](https://github.com/mimukit/tinytick).

## Build and test

Repo-wide build, test and smoke commands and the repo-wide rules are in the root [AGENTS.md](../../AGENTS.md). Run a tinydrop script from the repo root with `pnpm --filter tinydrop <script>`, or from this folder with `pnpm <script>`.

- `pnpm build` writes `dist/`
- `pnpm build:install` builds and copies `dist/` into Tinycast's extensions folder (macOS only)
- `pnpm smoke [<tinycast-checkout>]` runs the built bundles in Tinycast's JS runtime against a fake Raindrop server. `ONLY=<flowName>` runs one flow; each flow is a `flow*` function in `scripts/smoke.mjs`, and a new behavior adds one there
- `pnpm bench` seeds 10,000 bookmarks and prints the p50 and p95 write and query times
- `pnpm probe` checks the Phase 1 API facts against the live API; it reads `RAINDROP_TOKEN` from the environment (`set -a; . ./.env; set +a` inside the command)

Store tests call a real `sqlite3` binary and skip with a printed reason when none exists.

## Rules for agents

- Keep `src/api/`, `src/store/`, `src/sync/`, `src/search/`, `src/parse/`, `src/undo/`, `src/write/` and `src/cleanup/` free of `@raycast/api` imports, so Vitest can run them in Node.
- Never build a SQL literal by hand. Use `sqlString()` and `ftsTerm()` in `src/store/sql.ts`, because the `sqlite3` CLI has no bind parameters.
- Never put bookmark data in `Cache`. The store is the SQLite file in `environment.supportPath`.
- Never commit a Raindrop token. Scripts read it from an environment variable, and `plugins/tinydrop/.env` stays ignored. The root [AGENTS.md](../../AGENTS.md) copies it into a new worktree.
