// The playback session: start, stop, toggle and status of the one detached loop.
// Pure Node code with no @raycast/api import, so Vitest runs the real loop with
// a fake player.
//
// Files in the support folder (plan 0002, Locking, Process identity, Last sound
// and Player failure rows):
//   lock/          an mkdir lock that serializes start, stop and toggle
//   session.json   { pid, pgid, token, file, startedAt } of the loop that plays
//   last.json      { file } of the last started sound, for Toggle Sound
//   failure.json   written by the loop after three fast player failures
//
// No signal goes out from a PID alone: `ps` must show the recorded PGID and the
// session token first. A record that does not verify is deleted with no signal.
import { spawn as nodeSpawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AFPLAY, loopArgs } from "./loop";

export interface SessionRecord {
  pid: number;
  pgid: number;
  token: string;
  file: string;
  startedAt: number;
}

export interface FailureRecord {
  token: string;
  file: string;
  code: number;
  at: number;
}

/** What `ps` shows for one PID, or undefined when the PID is gone. */
export interface ProcessInfo {
  pgid: number;
  command: string;
}

/** The minimal child that `spawn` returns. */
export interface SpawnedChild {
  pid?: number;
  unref(): void;
}

export interface SessionOptions {
  /** The support folder that holds the lock and the records. */
  supportPath: string;
  /** The player binary. Defaults to /usr/bin/afplay; tests pass a fake player. */
  player?: string;
  /** Milliseconds since the epoch. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  spawn?: (command: string, args: string[]) => SpawnedChild;
  ps?: (pid: number) => ProcessInfo | undefined;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  /** How long stop waits after SIGTERM before it checks for SIGKILL. */
  stopGraceMs?: number;
  /** How long a lock waits for another holder before it gives up. */
  lockWaitMs?: number;
}

/** A lock older than this counts as stale and is removed. */
export const STALE_LOCK_MS = 10_000;
export const STOP_GRACE_MS = 2_000;
const LOCK_WAIT_MS = 5_000;
const POLL_MS = 50;

export class LockBusyError extends Error {
  constructor() {
    super("Another Tinynoise command holds the lock. Try again.");
    this.name = "LockBusyError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function defaultSpawn(command: string, args: string[]): SpawnedChild {
  return nodeSpawn(command, args, { detached: true, stdio: "ignore" });
}

/** Reads `ps -o pgid=,command=` for one PID. `ps` exits 1 when the PID is gone. */
export function readProcess(pid: number): ProcessInfo | undefined {
  try {
    const out = execFileSync("/bin/ps", ["-ww", "-o", "pgid=,command=", "-p", String(pid)], { encoding: "utf8" });
    const match = /^\s*(\d+)\s+([\s\S]*)$/.exec(out.trimEnd());
    return match ? { pgid: Number(match[1]), command: match[2] } : undefined;
  } catch {
    return undefined;
  }
}

/** True when the token appears as a whole argument in a `ps` command line. */
export function commandHasToken(command: string, token: string): boolean {
  return token.length >= 32 && command.split(/\s+/).includes(token);
}

export type StopResult = "stopped" | "none";
export type ToggleResult =
  | { action: "stopped" }
  | { action: "started"; file: string }
  | { action: "no-last" }
  | { action: "unplayable"; file: string };

export class Session {
  private readonly dir: string;
  private readonly player: string;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly spawn: (command: string, args: string[]) => SpawnedChild;
  private readonly ps: (pid: number) => ProcessInfo | undefined;
  private readonly kill: (pid: number, signal: NodeJS.Signals) => void;
  private readonly stopGraceMs: number;
  private readonly lockWaitMs: number;

  constructor(options: SessionOptions) {
    this.dir = options.supportPath;
    this.player = options.player ?? AFPLAY;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.spawn = options.spawn ?? defaultSpawn;
    this.ps = options.ps ?? readProcess;
    this.kill = options.kill ?? ((pid, signal) => process.kill(pid, signal));
    this.stopGraceMs = options.stopGraceMs ?? STOP_GRACE_MS;
    this.lockWaitMs = options.lockWaitMs ?? LOCK_WAIT_MS;
  }

  get lockPath() {
    return join(this.dir, "lock");
  }
  get sessionPath() {
    return join(this.dir, "session.json");
  }
  get lastPath() {
    return join(this.dir, "last.json");
  }
  get failurePath() {
    return join(this.dir, "failure.json");
  }

  // ─── Public commands ─────────────────────────────────────────────

  /** Stops the session that plays, if any, then starts the loop on `file`. */
  async start(file: string): Promise<SessionRecord> {
    return this.withLock(async () => {
      await this.stopLocked();
      return this.startLocked(file);
    });
  }

  /** Stops the verified session. Returns "none" when nothing plays. */
  async stop(): Promise<StopResult> {
    return this.withLock(() => this.stopLocked());
  }

  /**
   * Stops the session that plays, or starts the last sound again. `isPlayable`
   * checks the last file (the path check and `afinfo`). With no last sound the
   * result is "no-last"; with a last file that is gone or fails the check it is
   * "unplayable". Neither starts anything.
   */
  async toggle(isPlayable: (file: string) => boolean | Promise<boolean>): Promise<ToggleResult> {
    return this.withLock(async () => {
      if ((await this.stopLocked()) === "stopped") return { action: "stopped" };
      const last = this.readLast();
      if (!last) return { action: "no-last" };
      if (!(await isPlayable(last))) return { action: "unplayable", file: last };
      const record = await this.startLocked(last);
      return { action: "started", file: record.file };
    });
  }

  /**
   * The session that plays now, or undefined. A record whose group no longer
   * verifies is deleted, with no signal. Runs under the lock.
   */
  async current(): Promise<SessionRecord | undefined> {
    return this.withLock(async () => {
      const record = this.readSession();
      if (!record) return undefined;
      if (this.verifies(record)) return record;
      rmSync(this.sessionPath, { force: true });
      return undefined;
    });
  }

  /** The failure the loop wrote, if any. The marker is deleted once read. */
  takeFailure(): FailureRecord | undefined {
    const failure = readJson<FailureRecord>(this.failurePath, isFailure);
    rmSync(this.failurePath, { force: true });
    return failure;
  }

  /** The last started sound, for Toggle Sound. */
  readLast(): string | undefined {
    return readJson<{ file: string }>(this.lastPath, (v) => typeof v?.file === "string")?.file;
  }

  // ─── Identity ────────────────────────────────────────────────────

  /** True only when `ps` shows the recorded PID with the recorded PGID and the token. */
  verifies(record: SessionRecord): boolean {
    const info = this.ps(record.pid);
    return !!info && info.pgid === record.pgid && commandHasToken(info.command, record.token);
  }

  // ─── Internals, run under the lock ───────────────────────────────

  private async startLocked(file: string): Promise<SessionRecord> {
    mkdirSync(this.dir, { recursive: true });
    rmSync(this.failurePath, { force: true });
    const token = randomBytes(16).toString("hex");
    const child = this.spawn("/bin/sh", loopArgs(token, file, this.player, this.dir));
    child.unref();
    // Tinycast fills child.pid only after the current microtask.
    await Promise.resolve();
    const pid = child.pid;
    if (!pid) throw new Error("The playback loop did not start.");
    const info = this.ps(pid);
    if (!info || !commandHasToken(info.command, token)) throw new Error("The playback loop exited at once.");
    const record: SessionRecord = { pid, pgid: info.pgid, token, file, startedAt: this.now() };
    writeJson(this.sessionPath, record);
    writeJson(this.lastPath, { file });
    return record;
  }

  private async stopLocked(): Promise<StopResult> {
    const record = this.readSession();
    if (!record) return "none";
    if (!this.verifies(record)) {
      rmSync(this.sessionPath, { force: true });
      return "none";
    }
    this.signalGroup(record, "SIGTERM");
    const end = this.now() + this.stopGraceMs;
    while (this.verifies(record) && this.now() < end) await this.sleep(POLL_MS);
    if (this.verifies(record)) this.signalGroup(record, "SIGKILL");
    rmSync(this.sessionPath, { force: true });
    return "stopped";
  }

  private signalGroup(record: SessionRecord, signal: NodeJS.Signals) {
    try {
      this.kill(-record.pgid, signal);
    } catch {
      // The group exited between the check and the signal.
    }
  }

  private readSession(): SessionRecord | undefined {
    return readJson<SessionRecord>(this.sessionPath, isSessionRecord);
  }

  /** Runs `fn` while this command holds the mkdir lock. A lock older than 10 s is removed. */
  async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    mkdirSync(this.dir, { recursive: true });
    const end = this.now() + this.lockWaitMs;
    for (;;) {
      try {
        mkdirSync(this.lockPath);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const age = this.lockAge();
      if (age !== undefined && age > STALE_LOCK_MS) {
        rmSync(this.lockPath, { recursive: true, force: true });
        continue;
      }
      if (this.now() >= end) throw new LockBusyError();
      await this.sleep(POLL_MS);
    }
    try {
      return await fn();
    } finally {
      rmSync(this.lockPath, { recursive: true, force: true });
    }
  }

  private lockAge(): number | undefined {
    try {
      return this.now() - statSync(this.lockPath).mtimeMs;
    } catch {
      return undefined;
    }
  }
}

// ─── JSON files ──────────────────────────────────────────────────────

function readJson<T>(path: string, valid: (value: any) => boolean): T | undefined {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return valid(value) ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Writes through a temp file and a rename, so a reader never sees half a record. */
function writeJson(path: string, value: unknown) {
  const temp = `${path}.tmp`;
  writeFileSync(temp, JSON.stringify(value) + "\n");
  renameSync(temp, path);
}

const isInt = (v: unknown) => Number.isInteger(v) && (v as number) > 0;

function isSessionRecord(v: any): boolean {
  return isInt(v?.pid) && isInt(v?.pgid) && typeof v?.token === "string" && typeof v?.file === "string";
}

function isFailure(v: any): boolean {
  return typeof v?.file === "string" && typeof v?.token === "string";
}
