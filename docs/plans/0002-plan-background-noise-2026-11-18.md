# Plan: Background noise during work hours

Review: pending

Status: draft. The owner defers grilling to a separate session. This plan does not authorize implementation.

## Context

The owner wants local background sounds during work hours. Playback can run all day, so low CPU and memory use take priority. The owner selects Option A, a detached shell loop that runs `/usr/bin/afplay`.

The owner manually adds downloaded audio files to a durable sound directory. The plugin discovers those files and shows a native selection screen. The screen must accommodate ocean waves, river, rain, forest, and other sounds. The source of those sounds remains open.

Target: open. The owner has not accepted CPU or memory limits. The short spike supplies initial observations, but no all-day baseline or isolated `coreaudiod` overhead.

## Design decisions (settled)

| Decision | Resolution |
|----------|------------|
| Playback architecture | Option A. Tinycast commands control a detached `/bin/sh` loop that runs `/usr/bin/afplay` with local audio. |
| Audio acquisition | The owner manually adds downloaded files. The plugin discovers them automatically. Discovery timing remains open. |
| Schedule scope | Work hours remain in scope. Automatic start, automatic stop, and manual override behavior remain open. |
| Runtime cost | Avoid a permanent JavaScript engine or file watcher unless live use establishes a need. |
| Repository layout | Keep this plan in root `docs/plans/`. Choose the plugin name before creating `plugins/<name>/`. |
| Current authorization | Save and commit this draft on `main`. Do not implement, install tools, repeat the spike, file issues, or push. |
| Grilling | Continue in a separate session. The draft has no `Grilled:` stamp. |

## Repository and UI evidence

- Root `AGENTS.md` defines pnpm workspaces, shared packages, bundle limits, local checks, and artifact serials.
- `plugins/tinytick/package.json` supplies a manifest and script reference. Both existing plugins use TypeScript, React, and Vitest.
- `packages/build/bin/tinycast-build.mjs` builds command bundles. Reuse `@tinycast/build` instead of adding the Raycast CLI.
- `packages/config/` supplies shared configuration. `packages/smoke/src/index.mjs` supplies the Tinycast runtime harness.
- `packages/kit/src/ui/Picker.tsx` supplies a native form dropdown. Its comment records flattened submenus and scroll retention in pushed lists.
- Existing plugins use native `List`, `Form`, and `ActionPanel` components. No `DESIGN.md` or approved visual reference exists in the inspected repository.
- No shared playback or schedule utility exists in the inspected packages. Keep plugin-specific code local unless another plugin needs it.

Tinycast documents native `List`, `Grid`, and `Form` components. It does not establish a general custom modal API. Recommend a root native sound list with search and Enter to play. The owner must approve this substitute before implementation. The existing picker remains an alternative for a smaller selector.

Sources checked on 2026-11-18:

- [Tinycast compatibility](https://tinycast.dev/docs/extensions/compatibility/) documents the native components, child processes, and command modes.
- [Tinycast configuration](https://tinycast.dev/docs/extensions/customising/) documents preferences and background intervals. The shortest refresh interval is one minute. Failures increase the interval, so this is not an exact schedule guarantee.
- The configuration page states that uninstall removes the extension support folder. Do not choose that folder for irreplaceable downloaded sounds without an explicit retention decision.

## Verified spike evidence supplied by the owner

These results come from the earlier conversation on 2026-11-18. This planning session does not repeat the spike.

- The Mac runs macOS 27.2.1, build 26B131. Tinycast is 0.12.15, build 143, with bundle identifier `com.abueammar.tinycast`.
- Python 3.9.6, Swift 6.4.2, Node 26.13.1, npm, pnpm, `afplay`, `afconvert`, and `shortcuts` exist. The spike installs no tools.
- A real no-view command calls `spawn('/bin/sh', [loopScript, audioFile], { detached: true, stdio: 'ignore' })`, calls `child.unref()`, and returns.
- The owner hears AAC playback after palette closure, another command, and Command-Q.
- `ps` shows shell PID 36141 and PGID 36141. Player PID 36160 belongs to that group. The shell PPID changes from Tinycast PID 21736 to PID 1 after Tinycast exits.
- `child.pid` initially returns 0. It returns the actual PID after `await Promise.resolve()`.
- The temporary stop helper identifies spike processes and sends SIGTERM to the verified group. Both player processes disappear. This does not prove production identity validation.
- Four samples at one-minute intervals span only three minutes. `afplay` uses 0.1% CPU and RSS 7408–12720 KiB. The shell uses 0.0% CPU and RSS 1200–2112 KiB.
- `coreaudiod` fluctuates. The spike does not isolate its playback overhead.
- Five-minute mono 48 kHz, 16-bit brown-noise WAV and approximately 94.9 kbps AAC assets use a two-second crossfade. AAC playback works.
- The owner cancels the 30–60 minute measurement and restart listening tests. The WAV/AAC restart comparison does not occur. These remain unverified live-use risks and do not block planning.
- No Swift helper is built. Consider Option B only if live use establishes a reason, such as unacceptable restart gaps.
- The owner finds no Shortcuts action named “Background Sound.” No Noise On/Off shortcuts exist or pass a test. Option C is unavailable through that proposed method on this Mac.
- Spike arguments arrive as displayed labels. Normalization and validation correct the initial nonexistent path. This error does not establish an audio runtime failure.
- Every spike process, timer, audio file, script, log, extension, storage file, and support folder is removed. `/tmp/noise-spike.bhNhux` no longer exists. The spike leaves the repository unchanged.

## Approach

Use short-lived Tinycast commands for selection and control. Let the detached shell supervise `afplay`. Store downloaded sounds outside the installed bundle at the location the owner selects. Do not infer process ownership from a PID alone.

Option A is settled. A Swift helper adds build and maintenance cost without a demonstrated need. The proposed Shortcuts method is unavailable on this Mac.

The phases below describe proposed future work. Their scope and acceptance details remain subject to grilling.

### Phase 1: Settle the product and runtime contract

Attended: the owner selects the name, UI, resource target, sound storage, controls, and schedule behavior before implementation.

- Resolve the open questions below and update this file.
- Approve the existing native UI reference or another supported screen. Record the selection and date.
- Define the schedule behavior across sleep, wake, Tinycast exit, and manual Stop.
- Define the measurement method and accepted CPU and memory limits. Record any deferred live-use checks explicitly.
- Confirm test runners for shell lifecycle checks and native UI checks. Vitest covers pure TypeScript logic; the shared smoke harness covers Tinycast integration.

Done when: the plan records each decision as settled or explicitly deferred, names each attended check, and identifies every remaining implementation blocker.

### Phase 2: Add the native sound selector and discovery

- Create `plugins/<name>/` only after the owner settles the name. Reuse the shared build and configuration packages.
- Add the approved native screen, an empty state, and an action that opens the sound directory.
- Discover local files at the agreed times without a permanent watcher. Apply the agreed format and subdirectory rules.
- Validate file arguments and paths before playback. Keep displayed names separate from file identity.
- Test discovery with temporary directories through Vitest. Include added files, deleted files, duplicate names, and invalid paths.

Done when: the agreed discovery action shows a newly added supported file, selection resolves its real path, and invalid files cannot start playback.

### Phase 3: Add playback control and safe process ownership

- Start the detached shell loop with argument arrays and correct quoting. Account for Tinycast's delayed `child.pid` value.
- Apply the agreed duplicate-start, sound-switch, stop, and volume behavior.
- Design ownership records, exclusive start, stale-state recovery, and process-group validation before sending signals.
- Define child cleanup and bounded recovery for missing files, invalid audio, and player failures. Prevent a failed loop from consuming CPU continuously.
- Add deterministic lifecycle checks using short-lived fake players. Settle the runner in Phase 1. Never signal unrelated processes during a test.

Done when: lifecycle checks cover concurrent starts, stale ownership records, PID reuse, player failure, and group cleanup without affecting unrelated processes.

### Phase 4: Add the selected work-hours behavior

- Choose the schedule mechanism after the owner settles the required behavior. Assess Tinycast intervals against scheduling while Tinycast is closed.
- Define weekdays, time zone, overnight hours, daylight-saving changes, and missed boundaries.
- Apply the agreed sleep, wake, exit, restart, and manual override rules.
- Add schedule tests with an injected clock in Vitest. Cover the selected boundaries without real waiting.
- Document how the owner disables the schedule and stops any detached playback before uninstall.

Done when: clock-based tests reproduce the agreed schedule and override rules, and the documented disable action prevents the next automatic start.

### Phase 5: Check the plugin and document live-use limits

Attended: the owner approves native UI behavior and listening checks. The owner chooses the Tinycast checkout commit for runtime smoke checks.

- Run the repository's required checks during implementation, not during this planning session.
- Use `pnpm install --frozen-lockfile`, `sqlite3 --version`, `pnpm turbo run typecheck test build`, and `bash scripts/check-copies.sh`.
- Run `TINYCAST_DIR=<owner-selected-checkout> pnpm turbo run smoke`. Keep command bundles below 300 KB.
- Add plugin smoke flows through `@tinycast/smoke`. Distinguish harness results from real native UI and audible playback checks.
- Check the accepted resource limits using the measurement method from Phase 1. Report player, shell, and any measured audio-service cost separately.
- Keep the cancelled duration and restart comparisons marked unverified unless the owner later authorizes them. Do not require them before planning.
- Document supported formats, sound installation, controls, schedules, cleanup, and any bundled asset license.

Done when: the required checks pass, approved native checks have recorded results, and measurements meet the accepted target or explicitly identify the unmet limit. Deferred live-use checks remain visible.

## Open questions

No answers to the initial planning questions are accepted yet. Recommendations below remain proposals.

- Resource target. Ask for maximum CPU and combined shell/player memory use. Settle sampling duration, peak versus average, and treatment of `coreaudiod`.
- Work hours. Choose manual start with automatic stop, automatic start and stop, or manual playback with a reminder. The initial recommendation is manual start with automatic stop. Ask for weekdays, hours, and time zone.
- UI. Approve a root native sound list, a native dropdown, or a required separate modal. The initial recommendation is the root list. Verify material substitutes with the owner.
- Name. Settle the plugin name before creating its directory or deriving permanent storage paths.
- Durable directory. Choose a location that survives extension updates. Decide whether sounds must survive uninstall and whether the owner can change the location.
- Discovery. Choose scans on command open, an explicit refresh, or another trigger. Settle recursive scans, symlinks, hidden files, duplicate labels, and sorting.
- Formats. Define the initial allowlist and actual codec validation. AAC works in the spike; the WAV restart behavior remains untested. Do not claim every `afplay` format works in Tinycast.
- Built-in sounds. Choose no bundled sounds, bundled samples, or another source. If bundled, verify redistribution rights and preserve attribution before choosing assets.
- Controls. Settle Start, Stop, Toggle, pause/resume, sound switching, and status display. Decide what selection does when the same sound already plays.
- Volume. Choose system volume or per-player volume. Settle persistence and whether a volume change restarts playback.
- Duplicate starts. Define one active playback session, concurrent command behavior, and the response to a second start.
- Process identity. Settle ownership tokens, private state paths, PID and PGID validation, locking, stale records, and safe handling of PID reuse.
- Stop. Define SIGTERM handling, child cleanup, timeout, escalation, and the response when ownership cannot be proven.
- Schedule lifecycle. Define sleep behavior, wake recovery, missed starts, manual Stop suppression, Tinycast exit, login, reboot, and uninstall cleanup.
- Audio continuity. Decide what restart gap is acceptable during live use. Reopen Option B only when observed gaps or another measured failure justify it.
- Test infrastructure. Confirm the lifecycle runner and native check approach before the build. Keep real listening checks attended.

## Non-goals

- Implementation, tool installation, another spike, issue creation, or a push during this planning session.
- Streaming audio, automatic downloads, or accounts for sound services.
- A permanent JavaScript engine or file watcher without a demonstrated need.
- A Swift helper before live use establishes a reason.
- A guarantee of all-day resource use from the three-minute sample span.
- A claim that cancelled restart or duration tests pass.
- A plugin name or plugin directory before the owner accepts the name.
