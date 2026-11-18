// Lifecycle tests: they start the real /bin/sh loop with a fake player in a temp
// support folder. Every signal a test sends goes to a process group the test
// started, and the cleanup signals only groups that still verify by token.
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOOP_NAME, LOOP_SCRIPT, loopArgs } from "../src/playback/loop";
import { LockBusyError, Session, type SessionOptions, type SessionRecord, commandHasToken, readProcess } from "../src/playback/session";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let base: string;
let support: string;
let sounds: string;
let started: SessionRecord[];
let signals: { pid: number; signal: string }[];

function script(name: string, body: string) {
  const file = join(base, name);
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}

/** A player that plays "forever": it sleeps until a signal ends it. */
const goodPlayer = () => script("good-player", "exec sleep 30");
/** A player that fails at once, as afplay does on a corrupt file. */
const badPlayer = () => script("bad-player", "exit 3");
/** A player that ignores SIGTERM. */
/** It writes `<base>/stubborn-ready` once the trap is set, so a test can wait for that. */
const stubbornPlayer = () => script("stubborn-player", `trap '' TERM\n: > "${join(base, "stubborn-ready")}"\nsleep 30`);

function session(player: string, extra: Partial<SessionOptions> = {}) {
  return new Session({
    supportPath: support,
    player,
    kill: (pid, signal) => {
      signals.push({ pid, signal });
      process.kill(pid, signal);
    },
    ...extra,
  });
}

/** The PIDs of every live, non-zombie process in the group. */
function groupMembers(pgid: number): number[] {
  const out = spawnSync("/bin/ps", ["-A", "-o", "pid=,pgid=,stat="], { encoding: "utf8" }).stdout;
  return out
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .filter(([, g, stat]) => Number(g) === pgid && stat && !stat.startsWith("Z"))
    .map(([pid]) => Number(pid));
}

async function waitUntil(pred: () => boolean, what: string, ms = 5_000) {
  const end = Date.now() + ms;
  while (!pred()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(25);
  }
}

const sound = (name: string) => {
  const file = join(sounds, name);
  writeFileSync(file, "x");
  return file;
};

const readJsonFile = (path: string) => JSON.parse(readFileSync(path, "utf8"));

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "tinynoise-life-"));
  support = join(base, "support");
  sounds = join(base, "sounds");
  mkdirSync(sounds);
  started = [];
  signals = [];
});

afterEach(async () => {
  // Stop only groups this test started and that still carry their token.
  for (const record of started) {
    const info = readProcess(record.pid);
    if (info && info.pgid === record.pgid && commandHasToken(info.command, record.token)) {
      try {
        process.kill(-record.pgid, "SIGKILL");
      } catch {}
    }
  }
  rmSync(base, { recursive: true, force: true });
});

async function startTracked(s: Session, file: string) {
  const record = await s.start(file);
  started.push(record);
  return record;
}

describe("loop script", () => {
  it("is a POSIX sh string that takes the token and the file as argv", () => {
    const args = loopArgs("t".repeat(32), "/a b/rain.m4a", "/usr/bin/afplay", "/support");
    expect(args).toEqual(["-c", LOOP_SCRIPT, LOOP_NAME, "t".repeat(32), "/a b/rain.m4a", "/usr/bin/afplay", "/support"]);
    const check = spawnSync("/bin/sh", ["-n", "-c", LOOP_SCRIPT], { encoding: "utf8" });
    expect(check.status, check.stderr).toBe(0);
  });
});

describe("Session lifecycle", () => {
  it("starts a detached loop whose group verifies by PGID and token, then stops it with no child left", async () => {
    const s = session(goodPlayer());
    const file = sound("rain.m4a");
    const record = await startTracked(s, file);

    expect(record.pgid).toBe(record.pid);
    expect(s.verifies(record)).toBe(true);
    expect(readJsonFile(s.sessionPath)).toMatchObject({ pid: record.pid, token: record.token, file });
    expect(readJsonFile(s.lastPath)).toEqual({ file });
    await waitUntil(() => groupMembers(record.pgid).length >= 2, "the player under the loop");

    expect(await s.stop()).toBe("stopped");
    expect(signals).toEqual([{ pid: -record.pgid, signal: "SIGTERM" }]);
    await waitUntil(() => groupMembers(record.pgid).length === 0, "an empty group");
    expect(existsSync(s.sessionPath)).toBe(false);
    expect(existsSync(s.lockPath)).toBe(false);
    expect(await s.stop()).toBe("none");
  });

  it("switches: a start while a session plays stops the old group first", async () => {
    const s = session(goodPlayer());
    const first = await startTracked(s, sound("rain.m4a"));
    const second = await startTracked(s, sound("ocean.m4a"));

    expect(second.token).not.toBe(first.token);
    expect(signals).toEqual([{ pid: -first.pgid, signal: "SIGTERM" }]);
    await waitUntil(() => groupMembers(first.pgid).length === 0, "the old group to end");
    expect(s.verifies(second)).toBe(true);
    expect((await s.current())?.token).toBe(second.token);
    expect(readJsonFile(s.lastPath).file).toMatch(/ocean\.m4a$/);
  });

  it("serializes two concurrent starts, so one loop plays at the end", async () => {
    const player = goodPlayer();
    const a = session(player);
    const b = session(player);
    const [ra, rb] = await Promise.all([a.start(sound("rain.m4a")), b.start(sound("ocean.m4a"))]);
    started.push(ra, rb);

    const live = [ra, rb].filter((r) => a.verifies(r));
    expect(live).toHaveLength(1);
    const current = await a.current();
    expect(current?.token).toBe(live[0].token);
    const loser = ra === live[0] ? rb : ra;
    await waitUntil(() => groupMembers(loser.pgid).length === 0, "the first loop to end");
  });

  it("removes a lock older than 10 s, and waits on a fresh one", async () => {
    const s = session(goodPlayer(), { lockWaitMs: 200 });
    mkdirSync(support, { recursive: true });
    mkdirSync(s.lockPath);
    await expect(s.stop()).rejects.toBeInstanceOf(LockBusyError);

    const old = (Date.now() - 11_000) / 1000;
    utimesSync(s.lockPath, old, old);
    await startTracked(s, sound("rain.m4a"));
    expect(existsSync(s.lockPath)).toBe(false);
    expect(await s.stop()).toBe("stopped");
  });

  it("deletes a stale record whose PID is gone, and sends no signal", async () => {
    const gone = spawnSync("/bin/sh", ["-c", "echo $$"], { encoding: "utf8" });
    const pid = Number(gone.stdout.trim());
    const s = session(goodPlayer());
    mkdirSync(support, { recursive: true });
    writeFileSync(s.sessionPath, JSON.stringify({ pid, pgid: pid, token: "a".repeat(32), file: "/x.m4a", startedAt: 1 }));

    expect(await s.current()).toBeUndefined();
    expect(existsSync(s.sessionPath)).toBe(false);
    writeFileSync(s.sessionPath, JSON.stringify({ pid, pgid: pid, token: "a".repeat(32), file: "/x.m4a", startedAt: 1 }));
    expect(await s.stop()).toBe("none");
    expect(existsSync(s.sessionPath)).toBe(false);
    expect(signals).toEqual([]);
  });

  it("sends no signal when the recorded PID now belongs to a process without the token", async () => {
    // Stand-in for PID reuse: a process this test starts, whose argv has no token.
    const other = spawn("/bin/sh", ["-c", "exec sleep 30"], { detached: true, stdio: "ignore" });
    const pid = other.pid!;
    try {
      const s = session(goodPlayer());
      mkdirSync(support, { recursive: true });
      writeFileSync(s.sessionPath, JSON.stringify({ pid, pgid: pid, token: "b".repeat(32), file: "/x.m4a", startedAt: 1 }));

      expect(await s.stop()).toBe("none");
      expect(signals).toEqual([]);
      expect(existsSync(s.sessionPath)).toBe(false);
      expect(readProcess(pid)).toBeDefined();
    } finally {
      process.kill(-pid, "SIGKILL");
    }
  });

  it("ends the loop and writes failure.json after three fast player failures", async () => {
    const s = session(badPlayer());
    const file = sound('odd "name" \\ here.m4a');
    const record = await startTracked(s, file);

    await waitUntil(() => existsSync(s.failurePath), "failure.json");
    await waitUntil(() => groupMembers(record.pgid).length === 0, "the loop to exit");
    expect(s.takeFailure()).toMatchObject({ token: record.token, file, code: 3 });
    expect(existsSync(s.failurePath)).toBe(false);
    expect(await s.current()).toBeUndefined();
    expect(signals).toEqual([]);
  });

  it("sends SIGKILL to the group when the player ignores SIGTERM", async () => {
    const s = session(stubbornPlayer(), { stopGraceMs: 400 });
    const record = await startTracked(s, sound("rain.m4a"));
    // A group count of 2 can include the forked shell before the player sets its
    // trap, and SIGTERM then ends it. Wait until the trap is in place.
    await waitUntil(() => existsSync(join(base, "stubborn-ready")), "the player to ignore SIGTERM");

    expect(await s.stop()).toBe("stopped");
    expect(signals).toEqual([
      { pid: -record.pgid, signal: "SIGTERM" },
      { pid: -record.pgid, signal: "SIGKILL" },
    ]);
    await waitUntil(() => groupMembers(record.pgid).length === 0, "an empty group");
  });

  it("sends no SIGKILL when the group ends within the grace period", async () => {
    const s = session(goodPlayer());
    const record = await startTracked(s, sound("rain.m4a"));
    await s.stop();
    expect(signals.map((x) => x.signal)).toEqual(["SIGTERM"]);
    await waitUntil(() => groupMembers(record.pgid).length === 0, "an empty group");
  });

  it("toggles: stops a session, replays the last sound, and starts nothing without one", async () => {
    const s = session(goodPlayer());
    expect(await s.toggle(() => true)).toEqual({ action: "no-last" });

    const file = sound("rain.m4a");
    const record = await startTracked(s, file);
    expect(await s.toggle(() => true)).toEqual({ action: "stopped" });
    await waitUntil(() => groupMembers(record.pgid).length === 0, "an empty group");

    const again = await s.toggle(() => true);
    expect(again).toEqual({ action: "started", file });
    const current = await s.current();
    if (current) started.push(current);
    expect(current?.file).toBe(file);
    await s.stop();

    expect(await s.toggle(() => false)).toEqual({ action: "unplayable", file });
    expect(await s.current()).toBeUndefined();
  });
});

describe("commandHasToken", () => {
  it("needs the whole token as one argument", () => {
    const token = "c".repeat(32);
    expect(commandHasToken(`/bin/sh -c loop tinynoise-loop ${token} /a.m4a`, token)).toBe(true);
    expect(commandHasToken(`/bin/sh -c loop tinynoise-loop x${token} /a.m4a`, token)).toBe(false);
    expect(commandHasToken("/bin/sh -c loop", "")).toBe(false);
  });
});
