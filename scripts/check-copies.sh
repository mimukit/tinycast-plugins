#!/usr/bin/env bash
# The copy check from docs/plans/0001-plan-monorepo-merge-2026-11-18.md (Context).
# Prints each file or line that copies shared code into a plugin, and exits 1 on
# any match. Prints nothing and exits 0 when the tree is clean. Run it from any
# directory; it checks the repo that holds this script.
set -u

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root" || exit 2

skip=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=docs --exclude-dir=.afkkit --exclude-dir=.git)
found=0

report() {
  if [ -n "$1" ]; then
    printf '%s\n' "$1"
    found=1
  fi
}

# Shared files that must live in packages/, not in a plugin.
report "$(find plugins \( -name node_modules -o -name dist -o -name .turbo -o -name docs -o -name .afkkit \) -prune -o -type f \( -path '*/scripts/build.mjs' -o -path '*/src/components/Picker.tsx' -o -path '*/src/api/queue.ts' \) -print | sort)"

# The smoke harness's fake Keychain lives in @tinycast/smoke.
report "$(grep -rnE "${skip[@]}" 'function fakeKeychain' plugins)"

# Each plugin API error extends HttpApiError from @tinycast/kit.
report "$(grep -rnE "${skip[@]}" 'class [[:alnum:]_]*ApiError extends Error' plugins)"

# Only @tinycast/kit calls the Keychain tool.
report "$(grep -rnF "${skip[@]}" --exclude=check-copies.sh '/usr/bin/security' . | grep -v '^\./packages/kit/')"

exit "$found"
