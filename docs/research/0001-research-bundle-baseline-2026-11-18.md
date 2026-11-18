# Bundle baseline after the workspace move (2026-11-18)

Each command bundle as built by `pnpm turbo run build` at the end of Phase 2 of [the monorepo merge plan](../plans/0001-plan-monorepo-merge-2026-11-18.md), before any shared package exists. Phases 3 and 5 compare against this table and allow 1 KB of drift. "Build size" is the number the build prints; "Bytes" is `stat -c %s plugins/<plugin>/dist/<bundle>.js`.

| Plugin | Bundle | Build size (KB) | Bytes |
|--------|--------|-----------------|-------|
| tinydrop | `add-bookmark.js` | 43.5 | 44571 |
| tinydrop | `clean-up-bookmarks.js` | 74.5 | 76279 |
| tinydrop | `search-bookmarks.js` | 69.2 | 70856 |
| tinydrop | `sync.js` | 28.8 | 29521 |
| tinytick | `add-task.js` | 68.3 | 69920 |
| tinytick | `tasks.js` | 110.3 | 112940 |

The printed sizes match the per-plugin builds on `main` at ac6e406, so the move changed no bundle.
