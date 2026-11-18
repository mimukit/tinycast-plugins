# QA Plan: Monorepo workspace and shared packages (issue #1)

_Generated 2026-11-18 · against `90c44c6` (clean) · covers Phases 2 to 6 of `docs/plans/0001-plan-monorepo-merge-2026-11-18.md`_

## Summary
- The two plugins now build from one pnpm and Turborepo workspace, with shared code in four `@tinycast/*` packages.
- Working means the same tests, the same smoke flows, the same bundles within 1 KB, and the same behavior in real Tinycast on macOS.

## Environment
True for the whole plan. Do this once, before Scenario 1.

- Branch under test: `issue-1-move-both-plugins-onto-one-turbo-workspace-with` at `90c44c6`.
- A Mac with Tinycast installed, and the tinydrop and tinytick extensions already installed from the old repos, each signed in.
- A Raindrop test token and a TickTick API token in the Keychain from the old installs. Do not sign in again before TC-1.1.
- Screenshots: none. This change has no new screen.

Clone the branch and install with:

```sh
git clone -b issue-1-move-both-plugins-onto-one-turbo-workspace-with https://github.com/mimukit/tinycast-plugins && cd tinycast-plugins && pnpm install --frozen-lockfile
```

- [ ] Environment ready

## Test cases at a glance

Priority legend: 🔴 Critical · 🟡 Normal · 🟢 Low

| # | Scenario | Test case | Priority |
|------|----------|-----------|----------|
| TC-1.1 | 1: Mac with both old extensions installed and signed in | The new build replaces the old install and keeps each token | 🔴 Critical |
| TC-1.2 | 1: Mac with both old extensions installed and signed in | Each command works as before in real Tinycast | 🔴 Critical |

## Scenario 1: Mac with both old extensions installed and signed in

**Setup.** Run once, for every case in this scenario.

1. Quit Tinycast.

### TC-1.1: The new build replaces the old install and keeps each token  ·  🔴 Critical

**Goal.** The shared build installs into the same extension folders, and each plugin still finds its own Keychain token.

**Steps**

1. Build and install tinydrop from the repo root.

   ```sh
   pnpm --filter tinydrop build:install
   ```

   - [ ] The command prints each bundle size and an install path that ends in `extensions/tinydrop`
2. Build and install tinytick from the repo root.

   ```sh
   pnpm --filter tinytick build:install
   ```

   - [ ] The command prints an install path that ends in `extensions/tinytick`
3. Start Tinycast. Open "Search Bookmarks", then open "Tasks".
   - [ ] Neither command asks for a token again
     - tinydrop shows bookmarks with no "Token rejected" message
     - tinytick shows the task list with no sign-in screen

**Result**

- [ ] Pass
- [ ] Fail
- [ ] Skipped

**Notes.** _what actually happened on a fail; why it was skipped_

### TC-1.2: Each command works as before in real Tinycast  ·  🔴 Critical

**Goal.** The moved Keychain, queue, error and Picker code behaves the same on macOS as before the move.

**Steps**

1. In "Add Bookmark", add one test bookmark. Then use ⌘M on it in "Search Bookmarks" and pick a collection in the Picker.
   - [ ] The Picker opens, and the bookmark moves to the picked collection
2. In "Add Task", add one test task. In "Tasks", complete it, then undo.
   - [ ] The task completes, and the undo brings it back
3. Open the tinydrop Account screen. Remove the token, then paste it again.
   - [ ] The remove and the save both work with no error toast

**Result**

- [ ] Pass
- [ ] Fail
- [ ] Skipped

**Notes.** _what actually happened on a fail; why it was skipped_

**Reset.** Run after every case above. Delete the test bookmark and the test task in their apps.

## Automated verification (by AI agent)
_Checks the agent ran itself at `90c44c6` (clean), on Linux (node v24.22.3, pnpm 12.21.0, turbo 2.11.11). No action needed from the tester._

Commands run:

```sh
pnpm install --frozen-lockfile
```

```sh
pnpm turbo run typecheck test build --force
```

```sh
TINYCAST_DIR=/home/dev/projects/tinycast pnpm turbo run smoke --continue --force
```

```sh
ONLY=flowCleanupDuplicates TINYCAST_DIR=/home/dev/projects/tinycast pnpm --filter tinydrop smoke
```

```sh
bash scripts/check-copies.sh
```

```sh
find plugins -path '*/scripts/build.mjs'
```

```sh
grep -rn "function fakeKeychain\|function findAll" plugins/
```

```sh
grep -rn "Copied from" plugins packages
```

```sh
grep -rln "@raycast/api" packages/kit/src --exclude-dir=ui
```

```sh
git diff origin/main -- plugins/tinydrop/test/client.test.ts
```

- ✅ C1 · `pnpm install --frozen-lockfile` → exit 0.
- ✅ C2 · `pnpm turbo run typecheck test build --force` → exit 0, 8 of 8 tasks successful (both plugins, `@tinycast/kit` tests included).
- ❌ C3 · smoke → exit 1. tinytick prints `✓ smoke passed`. tinydrop passes the same 26 flows as `main`, then stops with `TypeError: Not a safe integer for SQL: undefined` in `flowCleanupEditLinks`. This crash is on `main` at `ac6e406` before this branch (pre-existing). The result matches the base, which is what the spec gate requires.
- ✅ C4 · `docs/research/0001-research-bundle-baseline-2026-11-18.md` → a table of all 6 bundles with sizes.
- ✅ C5 · `find plugins -path '*/scripts/build.mjs'` → no output.
- ✅ C6 · bundle bytes against the baseline → add-bookmark 45439 (+868), clean-up-bookmarks 76539 (+260), search-bookmarks 71116 (+260), sync 30384 (+863), add-task 70937 (+1017), tasks 113376 (+436). All are within 1024 bytes. `add-task.js` has 7 bytes of margin.
- ✅ C7 · `grep -rn "function fakeKeychain\|function findAll" plugins/` → no output.
- ✅ C8 · the 26 tinydrop `✓ flow` lines are identical to the base log, and tinytick ends with `✓ smoke passed` as on the base.
- ✅ C9 · `ONLY=flowCleanupDuplicates ... pnpm --filter tinydrop smoke` → exit 0, exactly 1 `✓ flow` line.
- ✅ C10 · `bash scripts/check-copies.sh` → exit 0, no output. The builder also saw it exit 1 and print the path when `plugins/tinytick/src/api/queue.ts` came back.
- ✅ C11 · `grep -rn "Copied from" plugins packages` → no output.
- ✅ C12 · `grep -rln "@raycast/api" packages/kit/src --exclude-dir=ui` → no output.
- ✅ C13 · `git diff origin/main -- plugins/tinydrop/test/client.test.ts` → empty. Typecheck, test and build pass. Smoke matches the base (see C3).
- ✅ C14 · `plugins/tinydrop/test/secrets.test.ts:44` and `plugins/tinytick/test/secrets.test.ts:97` assert the service set is exactly `tinydrop` and `tinytick`.
- ✅ C15 · `packages/kit/test/` holds `errors.test.ts`, `keychain.test.ts`, `queue.test.ts` (with a `runAll` test). `plugins/tinytick/test/` keeps `secrets.test.ts` and `queue.test.ts`.
- ✅ C16 · `.github/workflows/ci.yml` has a `gate` job (frozen install, `sqlite3 --version`, typecheck/test/build, `check-copies.sh`) and a `smoke` job at `21a0b7fd1f02c19a9fbd5cb0b7c162420aa7b1e2`. `pnpm dlx yaml-lint` passes. `actionlint` was not available.
- ⏳ C17 · the CI checks on the PR are read after the PR opens. The `smoke` job is expected to fail on the pre-existing tinydrop crash (C3).

## Not covered / needs human judgment
- `build:install` and the real Tinycast app run only on macOS. Scenario 1 covers them.
- The real macOS Keychain. Every automated check uses a fake `security` tool.
- The tinydrop flows after `flowCleanupEditLinks` (3 of 29) did not run on `main` or on this branch, because of the pre-existing crash.

## Overall result
_Tick one when you finish the run, or skip the ticks. Report each failure in the agent session or as a PR comment, and the agent records it here._

- [ ] Pass: every case passed
- [ ] Fail: at least one case failed
- [ ] Partial: cases were skipped or not reached
