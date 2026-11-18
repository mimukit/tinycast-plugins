# tinynoise

A [Tinycast](https://github.com/abue-ammar/tinycast) extension that plays local background sounds (rain, ocean, forest, anything you have as an audio file) on macOS. You pick a sound and close the launcher. A small `/bin/sh` loop keeps `/usr/bin/afplay` playing that file over and over, so no JavaScript engine stays alive while it plays. There is no schedule: you start and stop playback yourself.

## Status

Pre-release, personal use. The plan is in [docs/plans/0002-plan-background-noise-2026-11-18.md](../../docs/plans/0002-plan-background-noise-2026-11-18.md).

## Install

You need Tinycast with extensions turned on, Node 22 or later, and pnpm. From the repo root:

```sh
pnpm install
pnpm --filter tinynoise build
```

In Tinycast, open Settings › Extensions › Install New › Add from folder, and pick `plugins/tinynoise/dist/`. After that, `pnpm --filter tinynoise build:install` rebuilds and copies `dist/` over the installed copy. It writes to `~/Library/Application Support/com.abueammar.tinycast/extensions/tinynoise`. Set `TINYCAST_BUNDLE_ID` for another build of Tinycast, or `TINYCAST_EXT_DIR` for any other folder.

## The sound folder

Put your audio files in `~/Music/Tinynoise`. The extension creates the folder the first time Play Noise opens, and it reads the folder again each time the list opens (or when you press Refresh).

- Files directly in the folder show in a section called "Sounds".
- Each folder one level down shows as its own section, named after the folder. Files deeper than that are ignored.
- Hidden files and folders are skipped. A symlink counts only when it points to a regular file inside the sound folder.
- The name of a row is the file name without its extension. When two files in one section share a name, each row also shows the full file name.

Supported formats: `.m4a`, `.aac`, `.mp3`, `.wav`, `.aif`, `.aiff` and `.caf`, in any letter case. Before a sound plays, `afinfo` reads the file. A file it cannot read (a corrupt download, say) does not start.

Volume follows the system volume. There are no bundled sounds and no downloads.

## Commands

| Command | What it does |
|---|---|
| Play Noise | Lists your sounds. Enter plays the sound, or switches to it when another one plays. Enter on the sound that plays now does nothing. A "Now playing" row at the top shows the current sound, or the last failure when the player gave up. |
| Stop Noise | Stops the sound that plays. Says "Nothing plays" when there is none. |
| Toggle Noise | Stops the sound that plays, or plays the last sound again. When there is no last sound, or its file is gone, it says so and starts nothing. |

Actions on a row in Play Noise:

| Action | Keys |
|---|---|
| Play | `↵` |
| Stop | `⌘.` |
| Refresh | `⌘R` |
| Open Sound Folder | `⌘O` |
| Show in Finder | `⌘⇧F` |

Playback keeps going after you close the launcher and after you quit Tinycast. Only Stop Noise, Toggle Noise or the Stop action ends it. When the player fails three times in a row within two seconds of each start, the loop gives up and the next Play Noise shows the error.

## Uninstall

Run Stop Noise first. The playback loop runs outside Tinycast, so removing the extension does not stop a sound that plays. If you forget, quit it from a terminal with `pkill -f tinynoise-loop`.

Uninstall removes the extension's own support folder (its lock and its session records). It keeps `~/Music/Tinynoise` and your sounds, because that folder lives outside the extension.

## Development

```sh
pnpm --filter tinynoise typecheck
pnpm --filter tinynoise test                 # Vitest: discovery, path checks, and the real loop with a fake player
pnpm --filter tinynoise build                # dist/, and fails if a command bundle is over 300 KB
pnpm --filter tinynoise smoke ../tinycast    # runs the bundles in Tinycast's JS runtime, with temp folders and no audio
```

The lifecycle tests run on Linux and macOS. They start the loop with a fake player in a temp folder and signal only the process groups they started. `pnpm smoke` needs a Tinycast checkout (`git clone --depth 1 https://github.com/abue-ammar/tinycast`). It does not cover the Swift renderer or real audio.

## License

MIT. See [LICENSE](../../LICENSE).
