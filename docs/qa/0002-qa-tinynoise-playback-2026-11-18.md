# QA Plan: tinynoise background sound playback

_Generated 2026-11-18 · against `ac9a9e7` (clean) · covers issue #3, Phases 1 to 3: discovery, the playback loop and session, and the three commands_

## Summary
- tinynoise plays a sound file from `~/Music/Tinynoise` in a detached shell loop, until the owner stops it.
- Working means: the list shows the right sounds, one sound plays at a time, and Stop and Toggle end only the loop that tinynoise started.

## Environment
True for the whole plan. Do this once, before Scenario 1.

- Branch / build under test: `issue-3-add-local-background-sound-playback` at `ac9a9e7`, on the Mac with Tinycast 0.12.15 or later.
- No credentials, no server, no feature flags.
- Sound files: two or more real audio files (for example a rain `.m4a` and an ocean `.mp3`), plus one file that is not audio, renamed to `broken.m4a`.
- Screenshots: none. The plugin has no web page, so no browser driver ran.

Install with:

```sh
pnpm install && pnpm --filter tinynoise build:install
```

- [ ] Environment ready

## Test cases at a glance

Priority legend: 🔴 Critical · 🟡 Normal · 🟢 Low

| # | Scenario | Test case | Priority |
|------|----------|-----------|----------|
| TC-1.1 | 1: Empty sound folder | The empty state reads well | 🟡 Normal |
| TC-2.1 | 2: Seeded sound folder, nothing plays | The list looks right in the real app | 🔴 Critical |
| TC-2.2 | 2: Seeded sound folder, nothing plays | Play, switch and stop sound right | 🔴 Critical |
| TC-2.3 | 2: Seeded sound folder, nothing plays | Toggle Sound and Stop Sound feel right | 🔴 Critical |
| TC-2.4 | 2: Seeded sound folder, nothing plays | Playback survives Command-Q | 🔴 Critical |
| TC-2.5 | 2: Seeded sound folder, nothing plays | A corrupt file does not play | 🟡 Normal |

## Scenario 1: Empty sound folder

**Setup.** Run once, for every case in this scenario.

1. Move any existing sound folder out of the way.

```sh
[ -d ~/Music/Tinynoise ] && mv ~/Music/Tinynoise ~/Music/Tinynoise.qa-backup
```

- [ ] Setup complete

### TC-1.1: The empty state reads well  ·  🟡 Normal

**Goal.** A first-time owner learns where to put sounds from the empty list alone.

**Steps**

1. Open Tinycast and run "Play Sound".
   - [ ] The empty state is clear and looks native
     - title "No sounds yet"
     - the description names `~/Music/Tinynoise` and the seven formats
     - the icon and spacing match other Tinycast lists
2. Press Enter on "Open Sound Folder".
   - [ ] Finder opens the new, empty `~/Music/Tinynoise` folder

**Result**

- [ ] Pass
- [ ] Fail
- [ ] Skipped

**Notes.** _what actually happened on a fail; why it was skipped_

**Reset.** Run after the case above, before moving to Scenario 2. Restore the old folder when Setup moved one.

```sh
[ -d ~/Music/Tinynoise.qa-backup ] && rm -rf ~/Music/Tinynoise && mv ~/Music/Tinynoise.qa-backup ~/Music/Tinynoise
```

## Scenario 2: Seeded sound folder, nothing plays

**Setup.** Run once, for every case in this scenario.

1. Put two real audio files in the folder root and one in a subfolder. Copy the not-audio file in as `broken.m4a`.

```sh
mkdir -p ~/Music/Tinynoise/water
```

2. Make sure no sound plays. Run "Stop Sound" in Tinycast.

- [ ] Setup complete

### TC-2.1: The list looks right in the real app  ·  🔴 Critical

**Goal.** The owner approves the list layout in the real Tinycast renderer.

**Steps**

1. Run "Play Sound".
   - [ ] The sections and rows look right and read well
     - the "Sounds" section first, then one section for each subfolder
     - row names without extensions; a file name subtitle only on duplicate names
     - the music icon on each row
2. Press Command-K on a row.
   - [ ] The action panel lists Play, Stop, Refresh, Open Sound Folder and Show in Finder, with readable shortcuts

**Result**

- [ ] Pass
- [ ] Fail
- [ ] Skipped

**Notes.** _what actually happened on a fail; why it was skipped_

### TC-2.2: Play, switch and stop sound right  ·  🔴 Critical

**Goal.** Real audio plays, switches with no overlap, and stops when asked.

**Steps**

1. Press Enter on the rain sound.
   - [ ] The HUD says "Playing <name>", and the rain sound plays on a loop
   - [ ] The restart gap at the end of the file is acceptable to you
2. Run "Play Sound" again.
   - [ ] The "Now playing" row shows the rain sound at the top, and its section row shows "Playing"
3. Press Enter on the rain sound again.
   - [ ] A HUD says the sound already plays, and the audio does not restart
4. Press Enter on the ocean sound.
   - [ ] The rain stops and the ocean starts, with no overlap
5. Press Command-. (Stop).
   - [ ] The audio stops, and the "Now playing" row goes away

**Result**

- [ ] Pass
- [ ] Fail
- [ ] Skipped

**Notes.** _what actually happened on a fail; why it was skipped_

### TC-2.3: Toggle Sound and Stop Sound feel right  ·  🔴 Critical

**Goal.** The two no-view commands control playback without opening a list.

**Steps**

1. Run "Toggle Sound".
   - [ ] The last sound (ocean) plays again, with a "Playing" HUD
2. Run "Toggle Sound" again.
   - [ ] The audio stops, with a "Sound stopped" HUD
3. Run "Stop Sound".
   - [ ] The HUD says "Nothing plays"

**Result**

- [ ] Pass
- [ ] Fail
- [ ] Skipped

**Notes.** _what actually happened on a fail; why it was skipped_

### TC-2.4: Playback survives Command-Q  ·  🔴 Critical

**Goal.** Playback keeps going with Tinycast closed, and Stop still finds it after a restart.

**Steps**

1. Play the rain sound. Quit Tinycast with Command-Q.
   - [ ] The rain sound keeps playing
2. Open Tinycast again and run "Play Sound".
   - [ ] The "Now playing" row shows the rain sound
3. Run "Stop Sound".
   - [ ] The audio stops

**Result**

- [ ] Pass
- [ ] Fail
- [ ] Skipped

**Notes.** _what actually happened on a fail; why it was skipped_

### TC-2.5: A corrupt file does not play  ·  🟡 Normal

**Goal.** A file that afinfo cannot read gives a clear error and starts nothing.

**Steps**

1. Run "Play Sound". Press Enter on "broken".
   - [ ] A failure toast "Cannot play broken" explains the problem in plain words, and nothing plays

**Result**

- [ ] Pass
- [ ] Fail
- [ ] Skipped

**Notes.** _what actually happened on a fail; why it was skipped_

**Reset.** Run after every case above.

```sh
rm -f ~/Music/Tinynoise/broken.m4a
```

## Automated verification (by AI agent)
_Checks the agent ran itself. No action needed from the tester; listed here for context and sign-off._

Commands run (one per block; chain with `&&` when they must run together):

```sh
pnpm turbo run typecheck test build --filter=tinynoise --force
```

```sh
pnpm --filter tinynoise smoke /home/dev/projects/tinycast
```

```sh
bash scripts/check-copies.sh
```

```sh
TINYCAST_DIR=/home/dev/projects/tinycast pnpm turbo run smoke --concurrency=1
```

All results below ran on Linux at `ac9a9e7` (clean), with the Tinycast checkout at `21a0b7fd`. The repo-wide smoke run used the same content one step before the commit.

- ✅ C1 · `pnpm turbo run typecheck test build --filter=tinynoise --force` → 3 of 3 tasks; 3 test files, 38 tests passed. `plugins/tinynoise/AGENTS.md` exists. The repo-wide `typecheck test build` also passed, 11 of 11 tasks.
- ✅ C2 · manifest → `Play Sound:view, Stop Sound:no-view, Toggle Sound:no-view`.
- ✅ C3 · Vitest `puts root files first, then one section per first-level folder, sorted case-insensitive` passed. Smoke `flowSeededSections` showed `Sounds [Ocean, rain]`, `birds [forest]`, `dup [...]`, `water [River]`.
- ✅ C4 · Vitest cases for deeper files, hidden entries, other extensions, a symlink to a folder, a symlink outside the root and a dangling symlink passed. Smoke skipped `notes.txt`, `.hidden.m4a` and `water/deep/lake.m4a`.
- ✅ C5 · Vitest `shows the file name as a subtitle when labels match in one section` passed. Smoke showed `rain (rain.m4a)` and `Rain (Rain.mp3)`.
- ✅ C6 · Vitest `rejects a file deleted between scan and check`, `rejects a path outside the root after realpath` and `rejects a file replaced by a symlink to a file outside the root` passed.
- ✅ C7 · the discovery tests use temp folders; `bash scripts/check-copies.sh` printed nothing and exited 0.
- ✅ C8 · `src/playback/loop.ts` holds `LOOP_SCRIPT` as a string; `sh -n` accepts it (Vitest `is a POSIX sh string…`). Session spawns `/bin/sh` with `{ detached: true, stdio: "ignore" }` (session.ts:80). The player path is the `player` option.
- ✅ C9 · `await Promise.resolve()` comes before `child.pid` is read (session.ts:217).
- ✅ C10 · Vitest `serializes two concurrent starts` and `removes a lock older than 10 s, and waits on a fresh one` passed.
- ✅ C11 · Vitest `deletes a stale record whose PID is gone, and sends no signal` and `sends no signal when the recorded PID now belongs to a process without the token` passed. Smoke `flowStaleRecordSendsNoSignal` passed. Every signal goes through `signalGroup` after `verifies(record)` (session.ts:231-238).
- ✅ C12 · Vitest `sends SIGKILL to the group when the player ignores SIGTERM` recorded `SIGTERM` then `SIGKILL`; `sends no SIGKILL when the group ends within the grace period` recorded `SIGTERM` only.
- ✅ C13 · Vitest `ends the loop and writes failure.json after three fast player failures` passed, with a file name that holds quotes and a backslash.
- ✅ C14 · the ten lifecycle cases passed on Linux three runs in a row. Each run left no `tinynoise-loop` or `sleep 30` process.
- ✅ C15 · the tests signal only groups they started: the cleanup kills a group only when it still verifies by token. Two red runs confirmed the SIGKILL test and the PID-reuse test fail when their guard is removed.
- ✅ C16 · smoke `flowNowPlayingRow` (Now playing row first), `flowFailureRow` (`rain stopped`, marker deleted) and `flowEmptyState` (`No sounds yet`, Open Sound Folder opens the folder) passed.
- ✅ C17 · smoke `flowSeededSections` read the row actions → `Play, Stop, Refresh, Open Sound Folder, Show in Finder`.
- ✅ C18 · smoke: Play on a text file gave toast `Cannot play Ocean` and no `session.json`; Play on the current sound gave HUD `rain is already playing` and the loop kept running. Vitest `switches: a start while a session plays stops the old group first` passed.
- ✅ C19 · smoke `flowNowPlayingRow` Stop ended the stand-in group and deleted the record; `flowStopWithNothing` HUD → `Nothing plays`.
- ✅ C20 · Vitest `toggles: stops a session, replays the last sound, and starts nothing without one` passed. Smoke HUDs → `No last sound. Pick one in Play Sound.` and `Cannot play gone. Pick a sound in Play Sound.`
- ✅ C21 · 8 of 8 smoke flows passed with a temp home folder; `/home/dev/Music` does not exist after the run. No flow ran a player.
- ✅ C22 · bundle sizes → `play-sound.js 10.7 KB`, `stop-sound.js 5.6 KB`, `toggle-sound.js 7.0 KB`.
- ✅ C23 · `plugins/tinynoise/README.md` covers the sound folder, the seven formats, the three commands, "Run Stop Sound first" before uninstall, and that uninstall keeps `~/Music/Tinynoise`.
- ✅ repo-wide smoke → tinynoise, tinytick and tinydrop each printed `✓ smoke passed`, 6 of 6 tasks.

### Browser checks
_No browser driver applies. tinynoise is a launcher plugin with no web page. The smoke harness drove the built bundles in Tinycast's JS runtime instead._

## Not covered / needs human judgment
- C24 · the look of the list in the Swift renderer, and real audio through `afplay`, need the owner at the Mac. Scenario 2 covers both.
- `afinfo` and `afplay` exist only on macOS, so no automated run called them. The tests use a fake player and a fake `afinfo` check.
- The Phase 4 gate with the owner's chosen Tinycast commit, and the resource numbers, stay with the owner (Phase 4 of issue #3).

## Overall result
_Tick one when you finish the run, or skip the ticks. Report each failure in the agent session or as a PR comment, and the agent records it here._

- [ ] Pass: every case passed
- [ ] Fail: at least one case failed
- [ ] Partial: cases were skipped or not reached
