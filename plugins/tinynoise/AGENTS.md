# AGENTS.md

## Project

tinynoise is a [Tinycast](https://github.com/abue-ammar/tinycast) extension that plays local background sounds from `~/Music/Tinynoise`. A short-lived command starts a detached `/bin/sh` loop that runs `/usr/bin/afplay`, so no JavaScript engine stays alive during playback. It is a Raycast-format extension: a `package.json` manifest plus one CommonJS bundle per command, with `react`, `react/jsx-runtime` and `@raycast/api` left external. Stack: TypeScript, React, esbuild, Vitest. Package manager: pnpm. The design contract is [docs/plans/0002-plan-background-noise-2026-11-18.md](../../docs/plans/0002-plan-background-noise-2026-11-18.md).

## Build and test

Repo-wide build, test and smoke commands and the repo-wide rules are in the root [AGENTS.md](../../AGENTS.md). Run a tinynoise script from the repo root with `pnpm --filter tinynoise <script>`, or from this folder with `pnpm <script>`.

- `pnpm build` writes `dist/`.
- `pnpm build:install` builds and copies `dist/` into Tinycast's extensions folder (macOS only).
- `pnpm test` runs Vitest. The lifecycle tests start the real `/bin/sh` loop with a fake player in a temp support folder, so they run on Linux and macOS and play no audio.
- `pnpm smoke [<tinycast-checkout>]` runs the built bundles in Tinycast's JS runtime. Each flow is a `flow*` function in `smoke/flows.mjs`. The flows seed the sound folder and the support folder, and start no audio.

## Rules for agents

- Keep `src/sounds/` and `src/playback/` free of `@raycast/api` imports, so Vitest runs them in Node.
- Never signal a process from a PID alone. Every signal goes to a process group that `ps` shows with the recorded PGID and the session token.
- No test signals a process it did not start. Lifecycle tests use their own temp support folder and a fake player.
- The sound folder stays fixed at `~/Music/Tinynoise`. Lock, session, last-sound and failure files live in `environment.supportPath`.
