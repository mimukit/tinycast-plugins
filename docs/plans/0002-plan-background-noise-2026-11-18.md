# Plan: tinynoise, local background sounds

Grilled: 2026-11-18

Review: pending

Status: grilled. Ready to file as issues. The owner approves a commit and push of this plan on `main` and one issue per phase.

## Context

The owner wants local background sounds (ocean waves, river, rain, forest, and others) while they work. Playback can run all day, so low CPU and memory use take priority. A detached `/bin/sh` loop runs `/usr/bin/afplay`, so no JavaScript engine stays alive during playback.

The owner adds downloaded audio files to `~/Music/Tinynoise` by hand. The plugin finds them each time its list opens. The plugin has no schedule: the owner starts and stops playback by hand.

## Design decisions (settled)

| Decision | Resolution |
|----------|------------|
| Plugin name | `tinynoise`, title "Tinynoise", in `plugins/tinynoise/`. |
| Playback architecture | Option A. A short-lived Tinycast command starts a detached `/bin/sh -c <script>` loop that runs `/usr/bin/afplay` on a local file. No Swift helper. |
| Schedule | None. No work-hours logic, no interval command, no LaunchAgent. Playback runs until the owner stops it. |
| Sound folder | Fixed at `~/Music/Tinynoise`. No preference. The plugin creates the folder when it is missing. It survives uninstall, because it is outside the extension support folder. |
| Bundled sounds | None. The empty state names the folder and offers "Open Sound Folder". A "Generate Noise" action is a possible follow-up, not v1 scope. |
| Commands | Three. "Play Sound" (`view`, the list). "Stop Sound" (`no-view`). "Toggle Sound" (`no-view`): it stops the sound that plays, or it replays the last sound. |
| Volume | System volume only. No `afplay -v`, no volume preference. |
| Status display | A "Now playing" row at the top of the list, with a Stop action. No menu-bar command in v1. A menu-bar command with no interval is a possible follow-up. |
| UI | Native `List`, `List.Section`, `List.EmptyView` and `ActionPanel` only. No mockup. The owner approves the list in the real app in phase 4. |
| Resource target | No gate. Phase 4 records no measurement. The spike numbers below stay the only baseline. |
| Formats | Allowlist `.m4a .aac .mp3 .wav .aif .aiff .caf`, case-insensitive. `afinfo <file>` checks the file at play time. A file that fails the check does not start the loop. |
| Discovery | Scan on each open of the list, plus a "Refresh" action. No watcher. Files in the folder root form the first section. Each first-level subfolder forms one `List.Section`, named after the folder. Deeper levels are ignored. Hidden files and folders are skipped. A symlink counts only when it resolves to a regular file. Sort by label, case-insensitive. The label is the file name without its extension. When two labels in one section match, each shows its file name as a subtitle. |
| File identity | The list item carries the resolved absolute path, never the label. Before playback the path must still sit inside `~/Music/Tinynoise` after `realpath`, and must still be a regular file with an allowed extension. |
| Single session | One session only. A start while a session plays stops the old group first, then starts the new one. Enter on the sound that plays now does nothing and shows a HUD. |
| Locking | An `mkdir` lock at `<supportPath>/lock` serializes start, stop and toggle. A lock older than 10 s counts as stale and is removed. |
| Loop launch | `spawn('/bin/sh', ['-c', LOOP_SCRIPT, 'tinynoise-loop', token, file], { detached: true, stdio: 'ignore' })`, then `child.unref()`. The script is a POSIX `sh` string in the bundle, so no script file is written. Read `child.pid` after `await Promise.resolve()`, because Tinycast returns 0 before that. |
| Process identity | `<supportPath>/session.json` records the shell PID, the PGID, a random 128-bit hex token, the file path, and the start time. The token is in the loop argv. Before any signal, `ps -o pgid=,command= -p <pid>` must show the recorded PGID and the token. |
| Stop | SIGTERM to the verified group. Wait up to 2 s. Send SIGKILL only when the group still verifies. When ownership is not proven, delete the stale record and send no signal. |
| Last sound | `<supportPath>/last.json` keeps the path of the last started sound for "Toggle Sound". When it is missing or the file is gone, the command shows a HUD and starts nothing. |
| Player failure | When `afplay` exits non-zero in under 2 s three times in a row, the loop writes `<supportPath>/failure.json` and exits. The next list open shows the error in the "Now playing" row and deletes the marker. |
| Restart gap | Not measured. Reopen Option B (a Swift helper) only when the owner hears an unacceptable gap in live use. |
| Test runner | Vitest for pure logic (discovery, path checks, state parsing). Lifecycle tests also run in Vitest: they start the real `/bin/sh` loop with a fake player (a `sleep` script) in a temp support folder, on Linux and macOS. The `@tinycast/smoke` harness covers Tinycast integration and starts no audio. Listening stays attended. |
| Test isolation | Lifecycle tests signal only groups that they started and verified by token. No test signals a process it did not start. |
| Outward actions | Approved on 2026-11-18: commit and push this plan on `main`, and file one GitHub issue per phase. |

## Tinycast facts checked on 2026-11-18

A sub-agent read the Tinycast checkout at `../tinycast` (paths relative to that checkout).

- `environment.supportPath` is `~/Library/Application Support/<bundle id>/extension-support/<name>/`. An update keeps it. Uninstall deletes it (`Tinycast/Features/Extensions/Service/ExtensionCatalog.swift:77-82`, `:220-223`, `:255`). This suits the lock and the session files, but not the sounds.
- A user-started `no-view` command can call `showHUD` and `showToast`. A background launch drops all feedback (`ExtensionHostBridge.swift:387`).
- Preferences support `directory`, `file` and `dropdown`. No number type exists (`ExtensionManifest.swift:10-20`).
- `List.Section`, `List.EmptyView`, item `accessories` and `searchBarAccessory` exist (`Scripts/raycast-runtime/src/api/components.js:154`, `:200`).
- `MenuBarExtra` exists and holds no JavaScript while idle (`docs/features/extensions.md:25-27`). Interval commands run only while Tinycast runs, with a 60 s floor for `no-view` (`ExtensionRefreshPolicy.swift:6-8`). Tinycast has no API to run code at login or while it is closed.

## Verified spike evidence supplied by the owner

These results come from an earlier conversation on 2026-11-18. The grill does not repeat the spike.

- The Mac runs macOS 27.2.1, build 26B131. Tinycast is 0.12.15, build 143, with bundle identifier `com.abueammar.tinycast`.
- Python 3.9.6, Swift 6.4.2, Node 26.13.1, npm, pnpm, `afplay`, `afconvert`, and `shortcuts` exist. The spike installs no tools.
- A real no-view command calls `spawn('/bin/sh', [loopScript, audioFile], { detached: true, stdio: 'ignore' })`, calls `child.unref()`, and returns.
- The owner hears AAC playback after palette closure, another command, and Command-Q.
- `ps` shows shell PID 36141 and PGID 36141. Player PID 36160 belongs to that group. The shell PPID changes from Tinycast PID 21736 to PID 1 after Tinycast exits.
- `child.pid` initially returns 0. It returns the actual PID after `await Promise.resolve()`.
- The temporary stop helper sends SIGTERM to the verified group. Both player processes disappear. This does not prove production identity validation.
- Four samples at one-minute intervals span three minutes. `afplay` uses 0.1% CPU and RSS 7408–12720 KiB. The shell uses 0.0% CPU and RSS 1200–2112 KiB. `coreaudiod` fluctuates and is not isolated.
- Five-minute mono 48 kHz, 16-bit brown-noise WAV and approximately 94.9 kbps AAC assets use a two-second crossfade. AAC playback works. The WAV/AAC restart comparison does not occur.
- No Shortcuts action named "Background Sound" exists on this Mac, so Option C is unavailable.
- Spike arguments arrive as displayed labels. This is why the list item carries the path, not the label.
- The spike leaves no process, file, or repository change behind.

## Approach

Short-lived Tinycast commands select and control playback. The detached shell supervises `afplay`. The sounds live in `~/Music/Tinynoise`. The lock, session, last-sound and failure files live in `environment.supportPath`. No code infers process ownership from a PID alone.

Phases 1 and 2 do not depend on each other. Phase 3 needs both. Phase 4 needs phase 3.

### Phase 1: Scaffold the plugin and sound discovery (#3)

- Create `plugins/tinynoise/` with the structure, scripts and dev dependencies of `plugins/tinytick/`. Reuse `@tinycast/build`, `@tinycast/config` and `@tinycast/smoke`. Add an `AGENTS.md` for the plugin.
- Declare the three commands in the manifest. "Play Sound" can render a placeholder list in this phase; "Stop Sound" and "Toggle Sound" can show a "not built" HUD.
- Add a pure discovery module: input is a root path, output is sections of items with label, subtitle and resolved path. Apply every rule in the Discovery and Formats rows.
- Add a pure path check that resolves a path and confirms it is a regular allowed file inside the sound folder.
- Vitest covers, with temp folders: root files, one subfolder level, deeper files ignored, hidden files, symlinks to a file and to a folder, a symlink that points outside the root, duplicate labels, extension case, an unsupported extension, a missing root, and a file deleted between scan and check.

Done when: `pnpm turbo run typecheck test build` passes with `tinynoise` included, `bash scripts/check-copies.sh` is clean, and the discovery tests above pass.

### Phase 2: The playback loop and safe process ownership (#3)

- Write `LOOP_SCRIPT` as a POSIX `sh` string. It loops `afplay "$file"` (the player path is a parameter for tests), counts fast failures, writes `failure.json` after three, and exits. A SIGTERM trap stops the player.
- Write the session module: lock, start, stop, status, stale-record recovery, and the `ps` ownership check from the Process identity and Stop rows. Inject the support path, the player path, the `afinfo` check and the clock.
- Read `child.pid` after `await Promise.resolve()`.
- Vitest lifecycle tests start the real `/bin/sh` loop with a fake player in a temp support folder. They cover: start and stop; a start while a session plays (switch); two concurrent starts; a stale lock; a stale session record whose PID is gone; a session record whose PID now belongs to another process without the token (reuse); a player that fails fast three times; SIGKILL after an ignored SIGTERM; and no child left after stop.

Done when: the lifecycle tests pass on Linux and leave no process from the test behind, and no test signals a process it did not start.

### Phase 3: Commands, list and smoke flows (#3)

- "Play Sound": the "Now playing" row (or the failure from `failure.json`), then the sections from discovery, then `List.EmptyView` with "Open Sound Folder". Actions: Play (Enter), Stop, Refresh, Open Sound Folder, Show in Finder.
- Enter on a sound runs the `afinfo` check, then starts or switches. Enter on the sound that plays now shows a HUD and does nothing.
- "Stop Sound" stops the session and shows a HUD. With no session it shows "Nothing plays".
- "Toggle Sound" stops a session that plays, or starts the sound in `last.json`. With no last sound or a missing file it shows a HUD and starts nothing.
- Add `plugins/tinynoise/smoke/` with a `smoke/index.mjs` entry and `flow*` functions for: the empty state, a seeded folder with sections, the "Now playing" row from a seeded `session.json`, and the failure row from a seeded `failure.json`. Smoke flows start no audio.

Done when: `pnpm turbo run typecheck test build` passes, each command bundle stays under 300 KB, `bash scripts/check-copies.sh` is clean, and `TINYCAST_DIR=<checkout> pnpm --filter tinynoise smoke` passes the four flows.

### Phase 4: Live checks and docs (#3)

Attended: the owner picks the Tinycast checkout commit for smoke, listens on the Mac, and approves the list in the real app.

- Run `pnpm install --frozen-lockfile`, `sqlite3 --version`, `pnpm turbo run typecheck test build`, `bash scripts/check-copies.sh`, and `TINYCAST_DIR=<owner-selected-checkout> pnpm turbo run smoke`.
- Install with `pnpm --filter tinynoise build:install`. The owner checks: play, switch, stop, toggle, playback after Command-Q, the "Now playing" row, the empty state, and a corrupt file.
- Write `plugins/tinynoise/README.md`: the sound folder, supported formats, the three commands, how to stop playback before uninstall, and that uninstall keeps `~/Music/Tinynoise`.
- Record the results of each attended check in the plan or the issue. No resource measurement.

Done when: the repo checks pass, the owner records a pass or a named failure for each attended check, and the README exists.

## Non-goals

- A schedule, work hours, auto-start, auto-stop, reminders, or a LaunchAgent.
- Per-player or per-sound volume.
- Bundled sounds, streaming audio, automatic downloads, or accounts for sound services.
- A menu-bar command in v1.
- A permanent JavaScript engine or file watcher.
- A Swift helper before live use shows a reason.
- A resource gate or a new measurement. A claim that the cancelled restart or duration tests pass.
- Pause and resume. `afplay` has no pause, so Stop and Toggle cover it.

## Follow-ups (not filed)

- "Generate Noise" action that writes brown, pink or white noise into the sound folder.
- A menu-bar command with no interval, with Stop and the sound list.
