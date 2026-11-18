import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ROOT_SECTION_TITLE, discoverSounds } from "../src/sounds/discover";
import { isSoundName } from "../src/sounds/formats";
import { checkSoundPath, soundFolder } from "../src/sounds/path";

let base: string;
let root: string;

function touch(rel: string, at = root) {
  const file = join(at, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "x");
  return file;
}

const shape = (r = root) => discoverSounds(r).map((s) => ({ title: s.title, labels: s.sounds.map((x) => x.label) }));

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "tinynoise-")));
  root = join(base, "Tinynoise");
  mkdirSync(root);
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("discoverSounds", () => {
  it("puts root files first, then one section per first-level folder, sorted case-insensitive", () => {
    touch("rain.m4a");
    touch("Ocean.mp3");
    touch("brook.wav");
    touch("water/River.aiff");
    touch("water/creek.caf");
    touch("Birds/forest.aac");
    touch("alpha/wind.aif");
    expect(shape()).toEqual([
      { title: ROOT_SECTION_TITLE, labels: ["brook", "Ocean", "rain"] },
      { title: "alpha", labels: ["wind"] },
      { title: "Birds", labels: ["forest"] },
      { title: "water", labels: ["creek", "River"] },
    ]);
  });

  it("carries the resolved absolute path, not the label", () => {
    const file = touch("rain.m4a");
    expect(discoverSounds(root)[0].sounds[0]).toEqual({ label: "rain", path: file });
  });

  it("ignores files deeper than one folder level", () => {
    touch("water/deep/lake.m4a");
    touch("water/river.m4a");
    expect(shape()).toEqual([{ title: "water", labels: ["river"] }]);
  });

  it("skips hidden files and hidden folders", () => {
    touch(".hidden.m4a");
    touch(".secret/rain.m4a");
    touch("water/.dot.m4a");
    touch("water/river.m4a");
    expect(shape()).toEqual([{ title: "water", labels: ["river"] }]);
  });

  it("accepts allowed extensions in any case and skips other files", () => {
    touch("RAIN.M4A");
    touch("wind.WaV");
    touch("notes.txt");
    touch("cover.jpg");
    touch("noext");
    expect(shape()).toEqual([{ title: ROOT_SECTION_TITLE, labels: ["RAIN", "wind"] }]);
  });

  it("omits a folder with no sounds", () => {
    touch("empty/readme.txt");
    mkdirSync(join(root, "nothing"));
    expect(shape()).toEqual([]);
  });

  it("follows a symlink to a regular file inside the root", () => {
    const target = touch("water/river.m4a");
    symlinkSync(target, join(root, "link.m4a"));
    const [rootSection] = discoverSounds(root);
    expect(rootSection.sounds).toEqual([{ label: "link", path: target }]);
  });

  it("skips a symlink to a folder, as a file and as a section", () => {
    touch("water/river.m4a");
    symlinkSync(join(root, "water"), join(root, "linked"));
    symlinkSync(join(root, "water"), join(root, "folder.m4a"));
    expect(shape()).toEqual([{ title: "water", labels: ["river"] }]);
  });

  it("skips a symlink that points outside the root", () => {
    const outside = touch("outside.m4a", base);
    symlinkSync(outside, join(root, "escape.m4a"));
    touch("rain.m4a");
    expect(shape()).toEqual([{ title: ROOT_SECTION_TITLE, labels: ["rain"] }]);
  });

  it("skips a dangling symlink", () => {
    symlinkSync(join(root, "gone.m4a"), join(root, "dangling.m4a"));
    expect(shape()).toEqual([]);
  });

  it("shows the file name as a subtitle when labels match in one section", () => {
    touch("rain.m4a");
    touch("Rain.mp3");
    touch("ocean.wav");
    touch("water/rain.wav");
    const sections = discoverSounds(root);
    expect(sections[0].sounds.map((s) => [s.label, s.subtitle])).toEqual([
      ["ocean", undefined],
      ["rain", "rain.m4a"],
      ["Rain", "Rain.mp3"],
    ]);
    expect(sections[1].sounds[0].subtitle).toBeUndefined();
  });

  it("returns no sections for a missing root, or a root that is a file", () => {
    expect(discoverSounds(join(base, "missing"))).toEqual([]);
    expect(discoverSounds(touch("file.m4a", base))).toEqual([]);
  });

  it("works when the root itself is a symlink to a folder", () => {
    const file = touch("rain.m4a");
    const link = join(base, "link-root");
    symlinkSync(root, link);
    expect(discoverSounds(link)[0].sounds[0].path).toBe(file);
  });
});

describe("checkSoundPath", () => {
  it("accepts a regular sound file inside the root", () => {
    const file = touch("water/river.m4a");
    expect(checkSoundPath(root, file)).toEqual({ ok: true, path: file });
  });

  it("rejects a file deleted between scan and check", () => {
    const file = touch("rain.m4a");
    const [section] = discoverSounds(root);
    unlinkSync(file);
    expect(checkSoundPath(root, section.sounds[0].path)).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects a path outside the root after realpath", () => {
    const outside = touch("outside.m4a", base);
    expect(checkSoundPath(root, outside)).toEqual({ ok: false, reason: "outside" });
    expect(checkSoundPath(root, join(root, "..", "outside.m4a"))).toEqual({ ok: false, reason: "outside" });
  });

  it("rejects a file replaced by a symlink to a file outside the root", () => {
    const file = touch("rain.m4a");
    const outside = touch("outside.m4a", base);
    unlinkSync(file);
    symlinkSync(outside, file);
    expect(checkSoundPath(root, file)).toEqual({ ok: false, reason: "outside" });
  });

  it("rejects a folder, an unsupported extension, and the root itself", () => {
    mkdirSync(join(root, "folder.m4a"));
    expect(checkSoundPath(root, join(root, "folder.m4a"))).toEqual({ ok: false, reason: "not-a-sound" });
    expect(checkSoundPath(root, touch("notes.txt"))).toEqual({ ok: false, reason: "not-a-sound" });
    expect(checkSoundPath(root, root)).toEqual({ ok: false, reason: "outside" });
  });

  it("rejects any path when the root is missing", () => {
    expect(checkSoundPath(join(base, "missing"), touch("rain.m4a"))).toEqual({ ok: false, reason: "missing" });
  });
});

describe("formats and folder", () => {
  it("allows the seven formats in any case", () => {
    for (const ext of ["m4a", "AAC", "Mp3", "wav", "aif", "AIFF", "caf"]) expect(isSoundName(`a.${ext}`)).toBe(true);
    for (const name of ["a.ogg", "a.flac", "a", ".m4a.txt"]) expect(isSoundName(name)).toBe(false);
  });

  it("puts the sound folder at ~/Music/Tinynoise", () => {
    expect(soundFolder("/Users/me")).toBe("/Users/me/Music/Tinynoise");
  });
});
