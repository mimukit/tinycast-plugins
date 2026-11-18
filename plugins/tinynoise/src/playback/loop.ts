// The playback loop: a POSIX `sh` script that runs the player on one file again
// and again. A Tinycast command starts it detached and returns, so no
// JavaScript engine stays alive while a sound plays. The script lives in the
// bundle as a string; no script file is written.
//
// Arguments: $0 is the name "tinynoise-loop", $1 the session token, $2 the sound
// file, $3 the player, $4 the support folder. The token sits in the argv so that
// `ps` can prove the process group belongs to this session before any signal.
//
// On SIGTERM the trap forwards the signal to the player and waits for it, so the
// shell stays alive (and the group still verifies) while a player ignores the
// signal. The stopper then sends SIGKILL to the whole group.
//
// When the player exits non-zero in under 2 s three times in a row, the loop
// writes failure.json (through a temp file and mv) and exits.

/** The process name the loop shows as $0 in `ps`. */
export const LOOP_NAME = "tinynoise-loop";

/** The player Tinycast runs on macOS. Tests pass a fake player. */
export const AFPLAY = "/usr/bin/afplay";

/** Fast failures in a row that end the loop. */
export const FAST_FAILURE_LIMIT = 3;

/** A player run shorter than this, in seconds, counts as a fast failure when it exits non-zero. */
export const FAST_FAILURE_SECONDS = 2;

export const LOOP_SCRIPT = `PATH=/usr/bin:/bin:$PATH
token=$1 file=$2 player=$3 dir=$4 child= fails=0
stop() { if [ -n "$child" ]; then kill -TERM "$child" 2>/dev/null; wait "$child"; fi; exit 0; }
trap stop TERM INT HUP
while :; do
  start=$(date +%s)
  "$player" "$file" </dev/null >/dev/null 2>&1 &
  child=$!
  wait "$child"
  code=$?
  child=
  if [ "$code" -ne 0 ] && [ $(( $(date +%s) - start )) -lt ${FAST_FAILURE_SECONDS} ]; then
    fails=$((fails + 1))
    if [ "$fails" -ge ${FAST_FAILURE_LIMIT} ]; then
      esc=$(printf '%s' "$file" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g')
      printf '{"token":"%s","file":"%s","code":%s,"at":%s}\\n' "$token" "$esc" "$code" "$(date +%s)" >"$dir/failure.json.tmp" && mv -f "$dir/failure.json.tmp" "$dir/failure.json"
      exit 1
    fi
  else
    fails=0
  fi
done
`;

/** The argv after `-c` for `/bin/sh`: the script, then $0 to $4. */
export function loopArgs(token: string, file: string, player: string, supportPath: string): string[] {
  return ["-c", LOOP_SCRIPT, LOOP_NAME, token, file, player, supportPath];
}
