import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { afinfoAccepts, checkPlayable } from "../src/playback/playable";
import { soundLabel } from "../src/sounds/formats";

let base: string;
let root: string;

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "tinynoise-play-")));
  root = join(base, "Tinynoise");
  mkdirSync(root);
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("checkPlayable", () => {
  it("passes a file that the path check and afinfo accept", () => {
    const file = join(root, "rain.m4a");
    writeFileSync(file, "x");
    const seen: string[] = [];
    expect(checkPlayable(root, file, (f) => (seen.push(f), true))).toEqual({ ok: true, path: file });
    expect(seen).toEqual([file]);
  });

  it("stops a file that afinfo rejects", () => {
    const file = join(root, "corrupt.m4a");
    writeFileSync(file, "x");
    expect(checkPlayable(root, file, () => false)).toEqual({ ok: false, message: expect.stringMatching(/afinfo/) });
  });

  it("does not run afinfo on a file the path check rejects", () => {
    let ran = false;
    const result = checkPlayable(root, join(root, "gone.m4a"), () => (ran = true));
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/gone/) });
    expect(ran).toBe(false);
  });

  it("treats a missing afinfo binary as a rejection", () => {
    expect(afinfoAccepts(join(root, "rain.m4a"), join(base, "no-afinfo"))).toBe(false);
  });
});

describe("soundLabel", () => {
  it("drops the folder and the extension", () => {
    expect(soundLabel("/x/Music/Tinynoise/water/River Flow.m4a")).toBe("River Flow");
  });
});
