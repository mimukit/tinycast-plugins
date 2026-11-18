# Plan: Merge tinydrop and tinytick into the tinycast-plugins monorepo

Grilled: 2026-11-18

## Context

Two Tinycast plugins live in two repos: `mimukit/tinydrop` (Raindrop.io, 35 commits) and `mimukit/tinytick` (TickTick, 31 commits). tinydrop started as a copy of tinytick, so the two repos carry the same tooling and some of the same runtime code. A fix in one copy does not reach the other, and each new plugin would start one more copy.

Duplicated today (read from both repos on 2026-11-18):

- `scripts/build.mjs` is the same code in both. Only the header comment differs.
- `tsconfig.json`, `.gitignore`, `LICENSE` and the devDependency versions are the same. `vitest.config.ts` differs by one line (`passWithNoTests` in tinydrop).
- `src/components/Picker.tsx` is the same, except for one comment line.
- `src/auth/secrets.ts` has the same Keychain code. Only `KEYCHAIN_SERVICE` and the account names differ.
- `src/api/queue.ts` in tinydrop holds all of tinytick's version plus `runAll()`.
- `scripts/smoke.mjs` shares the harness code: `run()`, `fakeKeychain()`, `findAll()`, `press()`. The tinydrop `fakeKeychain()` also handles writes. The fake server and the flows belong to each plugin.
- Five tinydrop files carry the comment "Copied from tinytick": `secrets.ts`, `Picker.tsx`, `build.mjs`, `errors.ts` and `undo/stack.ts`. No file in `src/`, `scripts/` or `test/` is byte-identical between the repos, because each copy differs by at least a comment.
- `src/api/errors.ts` has the same `describe()` logic for 404, 429 and other codes, and the same `errorMessage()`. The 401 and 403 messages, the getters and `BulkGuardError` differ.
- `src/undo/stack.ts` started from tinytick, but the entry kinds differ completely. It is no longer a copy.

The goal is one GitHub repo that holds every Tinycast plugin, with one copy of each shared tool, so that a new plugin adds only its own code.

Target: 0 copied files between plugins, one root command runs the gate for every plugin, and each command bundle stays within 1 KB of the size recorded in Phase 2. "0 copied files" means the copy check in Phase 5 prints nothing: no `scripts/build.mjs`, `src/components/Picker.tsx`, `src/api/queue.ts` or `function fakeKeychain` under `plugins/`, no `class \w*ApiError extends Error` under `plugins/` (each must extend `HttpApiError`), and `/usr/bin/security` only under `packages/kit/`. `undo/stack.ts` stays in each plugin as separate code. Baseline: 5 files marked "Copied from tinytick", plus `build.mjs`, `tsconfig.json`, `Picker.tsx`, `queue.ts` and the smoke harness present twice.

## Design decisions (settled)

| Decision | Resolution |
|----------|-----------|
| Repo | New public repo `mimukit/tinycast-plugins`, the same visibility as both old repos. The local checkout is `/home/dev/projects/tinycast-plugins`, which already holds this plan. |
| Tooling | Turborepo with pnpm workspaces. `packageManager` stays `pnpm@12.9.1`. The root `pnpm-workspace.yaml` lists `packages/*` and `plugins/*` and keeps `allowBuilds: esbuild: true`. |
| Layout | `plugins/<name>/` for each plugin, `packages/<name>/` for shared code. Each plugin keeps its own `src/`, `test/`, `assets/`, `docs/`, plugin-only scripts (`probe`, `bench`, `make-icon`) and smoke flows. |
| History | Keep all commits. Git's built-in `git filter-branch --index-filter` moves each file to `plugins/<name>/` on a fresh clone of each repo (`git-filter-repo` is not on the box), then merge both into the new repo with `--allow-unrelated-histories`. `git log --follow` then works on every moved file. |
| Shared packages | Source-only TypeScript with no build step (the Turborepo "internal package" pattern). Each package exports `.ts` files, and esbuild bundles them into each command. `react`, `react/jsx-runtime`, `@raycast/api` and Node builtins stay external, as now. |
| Package list | `@tinycast/config` (base `tsconfig.json` and base Vitest config), `@tinycast/build` (the `tinycast-build` bin, from `build.mjs`), `@tinycast/smoke` (the smoke harness), `@tinycast/kit` (Keychain, write queue, base `HttpApiError`, `errorMessage()`) and `@tinycast/kit/ui` (Picker). `undo/stack.ts` stays in each plugin. |
| Raycast import rule | `@tinycast/kit` stays free of `@raycast/api`, so Vitest runs it in Node. Only `@tinycast/kit/ui` imports `@raycast/api`, as a peer dependency. This keeps the current agent rule in both repos. |
| User-visible identity | No change. Each manifest `name`, each Keychain service (`tinydrop`, `tinytick`) and each account name stays the same. `createKeychain({ service })` takes the service as a parameter. Current users keep their tokens and their install folder. |
| Smoke harness shape | `@tinycast/smoke` owns the Tinycast runtime boot, `fakeKeychain` (the tinydrop version, with writes), tree helpers and `ONLY=`, `VERBOSE=`, `TREE=` handling. Each plugin passes its own fake server, seed data and `flow*` functions. |
| Tinycast checkout path | The harness reads the first CLI argument (`pnpm smoke <path>`, as now), else `TINYCAST_DIR`, else resolves `../tinycast` from the repo root, not from the plugin folder. Turbo runs each task in the plugin folder, so the current default breaks. Docs and CI use `TINYCAST_DIR`. |
| Turbo tasks | `build` (outputs `dist/**`), `typecheck`, `test` are cached. `smoke`, `build:install`, `probe` and `bench` have `cache: false`. `smoke` depends on `build`. `smoke` passes through `TINYCAST_DIR`, `ONLY`, `VERBOSE`, `TREE`. `probe` passes through `RAINDROP_TOKEN`. |
| Test approach | No new kind of test. Each package and each plugin keeps Vitest (`vitest run`, files in `test/`). `packages/kit/test/` gets new tests: `keychain.test.ts`, `queue.test.ts` (with a first test for `runAll()`) and `errors.test.ts`. `tinytick/test/secrets.test.ts` and `tinytick/test/queue.test.ts` stay in tinytick, because they test tinytick functions, `UndoStack` and `test/fixtures.ts`. They now run against the kit. Smoke stays the Tinycast runtime harness. |
| Docs | Each plugin keeps its `docs/` folder, so its serials continue (`plugins/tinydrop/docs/plans/0003-...`). Repo-wide plans live in the root `docs/plans/`, starting with this file at `0001`. |
| Agent files | A root `AGENTS.md` holds the repo-wide rules: pnpm only, no Raycast CLI, no secret outside the Keychain, 300 KB per bundle, the docs naming rule (the tinydrop version, which scans worktrees). Each plugin keeps an `AGENTS.md` with its own rules, such as the tinydrop SQL rule and the tinytick `enableV2` rule. `CLAUDE.md` at each level points to its `AGENTS.md`. tinydrop's `.claude/CLAUDE.md` becomes `plugins/tinydrop/CLAUDE.md` in the tinytick shape. |
| Releases | Each plugin keeps its own `version`. A release is a git tag such as `tinydrop@0.2.0`. No Changesets, because nothing outside this repo reads the version. |
| CI Tinycast pin | The smoke job clones `abue-ammar/tinycast` at `21a0b7fd1f02c19a9fbd5cb0b7c162420aa7b1e2` (HEAD of `/home/dev/projects/tinycast` on 2026-11-18). The owner changes the pin by hand in a PR. |
| CI `sqlite3` | A CI step runs `sqlite3 --version` before `test`. A missing binary fails the job, so the store tests cannot skip on CI. |
| Base `HttpApiError` | `class HttpApiError extends Error { constructor(vendor, status, path, body) }` in `@tinycast/kit`. The base owns `status`, `path`, `body`, `isNotFound`, `isRateLimit`, and a `protected describe()` for 404, 429 and the fallback, built from `vendor`. Each subclass handles only 401 and 403 in its own `describe()`, then calls the base. tinydrop keeps `rateLimitReset`, `isTokenRejected`, `BulkGuardError` and the free function `isTokenRejected()`. tinytick keeps `isAuth`. |
| How phases land | Each of Phases 2 to 6 is one GitHub issue, built by afkkit on its own branch and opened as one PR to `main`. The owner merges each PR. A phase opens its PR only after its full done-when check passes locally. No force push. Changed on 2026-11-18, because afkkit always opens a PR. |
| Outward actions (approved 2026-11-18) | Phases 2 to 6: push a branch and open a PR to `main` of the new repo. Phase 6: open the test PR `test/ci-filter-tinytick`, read its job log, then close it with `gh pr close --delete-branch`. Phase 1 (repo creation, first push) and Phase 7 (labels, issue transfer, old README pushes, archives) stay attended. |
| Test runner | No new runner. Vitest for unit tests, the Tinycast runtime harness for smoke, GitHub Actions for CI from Phase 6. |
| Order of work | Move first with no behavior change, then extract one shared package for each phase. The full gate runs after each phase, so each failure has one cause. |

## Approach

The repo keeps the shape of the two current repos inside `plugins/`, then moves the duplicated parts into `packages/` one at a time. It reuses the code that exists: `tinytick/scripts/build.mjs` becomes `@tinycast/build`, the harness part of `tinydrop/scripts/smoke.mjs` becomes `@tinycast/smoke`, and the tinydrop copies of `secrets.ts`, `queue.ts` and `Picker.tsx` become `@tinycast/kit`.

Rejected options:

- `git subtree add` keeps the history too, but it puts the old paths in a merge commit, and `git log --follow` on a moved file stops at that commit.
- A copy with no history is simpler, but it drops 66 commits of context for each file.
- A shared package with its own build step (`tsc` to `dist/`) adds a Turbo dependency edge and a build per change, with no gain. esbuild already bundles each command.

### Phase 1: Create the repo and import the history (built 2026-11-18)

Attended: the owner approves the creation of the public repo `mimukit/tinycast-plugins` and the first push.

- Clone `mimukit/tinydrop` and `mimukit/tinytick` fresh into the scratchpad. Do not rewrite `/home/dev/projects/tinydrop` or `/home/dev/projects/tinytick`.
- In each fresh clone, run `git filter-branch --index-filter` to prefix every path with `plugins/<name>/`.
- Run `git init -b main` in `/home/dev/projects/tinycast-plugins`. Commit this plan file as the root commit.
- Merge the filtered tinytick clone, then the filtered tinydrop clone, each with `--allow-unrelated-histories`.
- Create the repo with `gh repo create mimukit/tinycast-plugins --public` and push `main`.
- Leave the old branch `feat/tinytick-v1` in `mimukit/tinytick`. It has no commits beyond `main`, and the archive in Phase 7 freezes it.

Done when: `git rev-list --count` on the second parent of each import merge prints 35 for tinydrop and 31 for tinytick (`git log -- <path>` prints 34 and 30, because it hides the one merge commit in each old repo), `git log --follow plugins/tinydrop/src/auth/secrets.ts` reaches the first tinydrop commit, and `gh repo view mimukit/tinycast-plugins` shows `main`.

### Phase 2: Add the workspace with no code change

- Add the root `package.json` (private, `packageManager: pnpm@12.9.1`, devDependencies `turbo`, `typescript`, `vitest`, `esbuild`, `@types/node`), `pnpm-workspace.yaml` and `turbo.json` as in the design decisions.
- Add root scripts: `build`, `typecheck`, `test`, `smoke`, each as `turbo run <task>`.
- Delete `pnpm-lock.yaml` and `pnpm-workspace.yaml` in each plugin. Run `pnpm install` at the root to make one lockfile.
- Move `.gitignore` and `LICENSE` to the root and add `.turbo/` to `.gitignore`. Delete the plugin copies.
- Change the default Tinycast path in both `scripts/smoke.mjs` files so that it resolves from the repo root.
- Write the root `AGENTS.md` and `CLAUDE.md`. Cut the repo-wide rules out of each plugin `AGENTS.md`. Move the tinydrop worktree setup to the root and change the `.env` path to `plugins/tinydrop/.env`.
- If `turbo` needs a flag or a config change for pnpm 12 or TypeScript 7, stop and add the change to this plan before you continue.
- Record the size of each command bundle from `pnpm turbo run build` in `docs/research/0001-research-bundle-baseline-2026-11-18.md`.

Done when: `pnpm install --frozen-lockfile` passes, `pnpm turbo run typecheck test build` passes for both plugins, `TINYCAST_DIR=<checkout> pnpm turbo run smoke` passes every flow of both plugins, and the baseline file lists every bundle of both plugins.

### Phase 3: Extract `@tinycast/config` and `@tinycast/build`

- Make `packages/config` with `tsconfig.base.json` (the current shared `tsconfig.json`) and `vitest.base.ts`. Each plugin `tsconfig.json` keeps only `extends` and `include`. Each plugin `vitest.config.ts` merges the base. tinydrop keeps `passWithNoTests`.
- Make `packages/build` with the `tinycast-build` bin. It reads `package.json`, `src/manifest.json` and `assets/` from the current folder and keeps `--dev`, `--install`, `TINYCAST_EXT_DIR`, `TINYCAST_BUNDLE_ID`, the icon hash and the 300 KB check.
- Change each plugin `build` script to `tinycast-build` and `build:install` to `tinycast-build --install`. Delete both `scripts/build.mjs` files.
- Leave `tinydrop/scripts/lib/load-store.mjs` in the plugin. Only tinydrop has a store.

Done when: no `scripts/build.mjs` exists under `plugins/`, `pnpm turbo run typecheck test build` passes, smoke passes for both plugins, and each bundle size is within 1 KB of the Phase 2 baseline.

### Phase 4: Extract `@tinycast/smoke`

- Make `packages/smoke` from the harness part of `tinydrop/scripts/smoke.mjs`: the Tinycast path check, the runtime import, `run()`, `fakeKeychain()` with a `service` option, `findAll()`, `press()`, `pressIn()`, `pressPrefix()`, `typeSearch()`, `setField()`, `waitFor()`, `runToastAction()`, `pickDropdown()`, and the `ONLY=` flow filter.
- Merge the tinytick helpers that tinydrop lacks (`pressOn()`, `choose()`) and its `v2` option, as a general `preferences` option.
- Keep in each plugin a `smoke/` folder with the fake server, the seed data and the `flow*` functions. tinydrop keeps its SQLite seeding through `load-store.mjs`.
- Change each plugin `smoke` script to the new entry file. Delete both old `scripts/smoke.mjs` files.

Done when: `grep -rn "function fakeKeychain\|function findAll" plugins/` prints nothing, `pnpm turbo run smoke` passes every flow of both plugins with the same flow count as Phase 2, and `ONLY=<flowName> pnpm --filter tinydrop smoke` runs one flow.

### Phase 5: Extract `@tinycast/kit`

- Make `packages/kit/src/keychain.ts` from the shared part of `secrets.ts`: `createKeychain({ service })` returns `read`, `write`, `remove`, and the file exports `quoteArg` and `addCommand`. Each plugin `src/auth/secrets.ts` keeps its own account names and its own functions on top of the kit (tinydrop: `saveToken`, `deleteToken`; tinytick: `saveApiToken`, `saveV2Cookie`, `signOut`).
- Make `packages/kit/src/queue.ts` from the tinydrop `queue.ts`, with `run()` and `runAll()`. Change tinytick to import it.
- Make `packages/kit/src/ui/Picker.tsx` from the shared `Picker.tsx`, exported as `@tinycast/kit/ui`. Delete both plugin copies.
- Move `tinytick/test/secrets.test.ts` and `tinytick/test/queue.test.ts` to `packages/kit/test/`. Add a test that each plugin `secrets.ts` still uses its own service name.
- Make `packages/kit/src/errors.ts` with the base `HttpApiError` from the design decisions and `errorMessage()`. `RaindropApiError` and `TickTickApiError` extend it and keep their names, so each `instanceof` check stays the same. Each message stays the same text.
- Leave `undo/stack.ts` in each plugin. Change its comment from "Copied from tinytick" to "Started from tinytick".
- Remove the other "Copied from tinytick" comments.
- Add `scripts/check-copies.sh` at the root. It prints each match of the copy check in the Context section and exits non-zero on a match.

Done when: `scripts/check-copies.sh` prints nothing and exits 0, `grep -rn "Copied from" plugins packages` prints nothing, `grep -rln "@raycast/api" packages/kit/src --exclude-dir=ui` prints nothing, `pnpm turbo run typecheck test build smoke` passes with every tinydrop error-message test unchanged, and each bundle size is within 1 KB of the Phase 2 baseline.

### Phase 6: Add CI

- Add `.github/workflows/ci.yml`. It runs on each push to `main` and each PR: set up pnpm and Node, `pnpm install --frozen-lockfile`, then `sqlite3 --version`, then `pnpm turbo run typecheck test build`, then `scripts/check-copies.sh`.
- Add a smoke job that clones `abue-ammar/tinycast` at the pinned commit in the design decisions and runs `pnpm turbo run smoke` with `TINYCAST_DIR` set.
- On PRs, filter the tasks to changed packages with `--filter=...[origin/main]`.
- Merge the CI PR to `main`. Then open the test PR from branch `test/ci-filter-tinytick` with one comment line in `plugins/tinytick/README.md`. Read the job log, then run `gh pr close --delete-branch`.

Done when: the CI run on `main` shows green for both jobs, the test PR shows green checks and its job log skips the tinydrop tasks, and the test PR is closed with its branch deleted.

### Phase 7: Cut over from the old repos

Attended: the owner approves each outward action (the new labels, the issue transfer, the README change and the archive of both old repos). This phase must come last, because it needs the new repo to work first.

- Create the labels `ready` and `medium` in `mimukit/tinycast-plugins` with `gh label create`, so the transfer keeps them.
- Transfer tinydrop issue #2: `gh issue transfer 2 mimukit/tinycast-plugins -R mimukit/tinydrop`. Change its paths to `plugins/tinydrop/`.
- Add a line to the top of each old README that points to `mimukit/tinycast-plugins`. Push it.
- Archive both old repos with `gh repo archive`.
- Change the plugin README files in the new repo so that each build command runs from the repo root or with `pnpm --filter <name>`.

Done when: `gh repo view mimukit/tinydrop --json isArchived` and the same for tinytick print `true`, issue #2 is open in `mimukit/tinycast-plugins` with the labels `ready` and `medium`, and on a fresh clone of the new repo `pnpm install --frozen-lockfile && pnpm turbo run typecheck test build` passes, `scripts/check-copies.sh` exits 0, and each bundle stays within 1 KB of the Phase 2 baseline.

## Open questions

None. The grill on 2026-11-18 settled all of them.

## Non-goals

- A `pnpm new-plugin` generator. Write it after the third plugin, when the common shape is clear.
- A change to plugin features or behavior. Each phase keeps the same smoke flows and the same Vitest results.
- A change to a manifest name, a Keychain service, a Keychain account or an install folder.
- A publish of the shared packages to npm. They stay private workspace packages.
- A publish to the Raycast store, or the Raycast CLI.
- A delete of the local clones at `/home/dev/projects/tinydrop` and `/home/dev/projects/tinytick`. The owner removes them after Phase 7.
- A change to the Tinycast app repo.
