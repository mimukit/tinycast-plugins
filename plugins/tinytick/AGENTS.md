# AGENTS.md

## Project

tinytick is a TickTick extension for the [Tinycast](https://github.com/abue-ammar/tinycast) launcher. It talks to the TickTick web API directly and needs no TickTick desktop app. It is a Raycast-format extension: a `package.json` manifest plus one CommonJS bundle per command, with `react`, `react/jsx-runtime` and `@raycast/api` left external. Stack: TypeScript, React, esbuild, Vitest, chrono-node. Package manager: pnpm.

## Build and test

Repo-wide build, test and smoke commands and the repo-wide rules are in the root [AGENTS.md](../../AGENTS.md). Run a tinytick script from the repo root with `pnpm --filter tinytick <script>`, or from this folder with `pnpm <script>`.

- `pnpm build` writes `dist/`
- `pnpm build:install` builds and copies `dist/` into Tinycast's extensions folder (macOS only)
- `pnpm smoke [<tinycast-checkout>]` runs the built bundles in Tinycast's JS runtime against a fake TickTick server. Run it after `pnpm build` when you change a command or a component. `ONLY=<flowName>` runs one flow; each flow is a `flow*` function in `smoke/flows.mjs`, and a new behavior adds one there and to `FLOWS`.

## Rules for agents

- Keep `src/parse/`, `src/views/`, `src/undo/` and `src/api/` free of `@raycast/api` imports, so Vitest can run them in Node.
- Every `/api/v2` call must sit behind the `enableV2` preference.
