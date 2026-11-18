// The tinynoise smoke flows, in run order. Each flow is one async function in
// FLOWS; a new behavior adds one there. `ONLY=flowName pnpm smoke …` runs one flow.
// No flow plays audio. The seeded files hold text, so a Play press must stop at
// the afinfo check.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findAll, press, pressOn, rowTitles, sleep } from "@tinycast/smoke";
import { makeHome, run, soundsIn } from "./harness.mjs";

const sections = (ctx) =>
  findAll(ctx.tree(), (n) => n.type === "List.Section").map((s) => ({
    title: s.props.title,
    rows: findAll(s, (n) => n.type === "List.Item").map((n) => n.props.subtitle ? `${n.props.title} (${n.props.subtitle})` : n.props.title),
  }));

const huds = (ctx) => ctx.toasts.filter((t) => t?.hud).map((t) => t.hud);
const toastTitles = (ctx) => ctx.toasts.filter((t) => t?.title).map((t) => t.title);

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function flowEmptyState() {
  const home = makeHome();
  return run("play-sound", { home, interact: async (ctx) => {
    assert.deepEqual(rowTitles(ctx), [], "no rows");
    const empty = findAll(ctx.tree(), (n) => n.type === "List.EmptyView")[0];
    assert.ok(empty, "the empty view shows");
    assert.equal(empty.props.title, "No sounds yet");
    assert.match(empty.props.description, /Music\/Tinynoise/);
    assert.ok(existsSync(soundsIn(home)), "the command creates ~/Music/Tinynoise");
    await press(ctx, "Open Sound Folder");
    assert.deepEqual(ctx.opened, [soundsIn(home)], "Open Sound Folder opens the sound folder");
  }});
}

async function flowSeededSections() {
  const sounds = [
    "rain.m4a", "Ocean.MP3", "notes.txt", ".hidden.m4a",
    "water/River.wav", "water/deep/lake.m4a", "birds/forest.aac", "dup/rain.m4a", "dup/Rain.mp3",
  ];
  const home = makeHome(sounds);
  return run("play-sound", { home, interact: async (ctx) => {
    assert.deepEqual(sections(ctx), [
      { title: "Sounds", rows: ["Ocean", "rain"] },
      { title: "birds", rows: ["forest"] },
      { title: "dup", rows: ["rain (rain.m4a)", "Rain (Rain.mp3)"] },
      { title: "water", rows: ["River"] },
    ]);
    const forest = findAll(ctx.tree(), (n) => n.type === "List.Item" && n.props.title === "forest")[0];
    const actions = findAll(forest.props.actions, (n) => n.type === "Action").map((n) => n.props.title);
    assert.deepEqual(actions, ["Play", "Stop", "Refresh", "Open Sound Folder", "Show in Finder"]);

    await pressOn(ctx, "forest", "Show in Finder");
    assert.deepEqual(ctx.opened, [`finder:${join(soundsIn(home), "birds/forest.aac")}`]);

    await pressOn(ctx, "Ocean", "Play");
    assert.deepEqual(toastTitles(ctx), ["Cannot play Ocean"], "a file afinfo cannot read does not play");
    assert.ok(!existsSync(join(ctx.supportPath, "session.json")), "no session starts");

    await pressOn(ctx, "forest", "Refresh");
    assert.equal(sections(ctx).length, 4, "Refresh keeps the sections");
  }});
}

async function flowNowPlayingRow() {
  const home = makeHome(["rain.m4a", "ocean.m4a"]);
  const token = randomBytes(16).toString("hex");
  // A stand-in loop: a sleep with the token in its argv, in its own group. It plays nothing.
  const loop = spawn("/bin/sh", ["-c", "sleep 30; :", "tinynoise-loop", token], { detached: true, stdio: "ignore" });
  loop.unref();
  const pid = loop.pid;
  const file = join(soundsIn(home), "rain.m4a");
  try {
    return await run("play-sound", {
      home,
      records: { "session.json": { pid, pgid: pid, token, file, startedAt: Date.now() } },
      interact: async (ctx) => {
        assert.deepEqual(sections(ctx)[0], { title: "Now playing", rows: ["rain (Now playing)"] });
        const playing = findAll(ctx.tree(), (n) => n.type === "List.Item" && n.props.title === "rain").at(-1);
        assert.deepEqual(playing.props.accessories, [{ text: "Playing" }], "the sound row marks the sound that plays");

        await pressOn(ctx, "rain", "Play");
        assert.deepEqual(huds(ctx), ["rain is already playing"], "Enter on the current sound only shows a HUD");
        assert.ok(alive(pid), "the loop still runs");

        await press(ctx, "Stop", 800);
        assert.ok(toastTitles(ctx).includes("Sound stopped"), `toasts: ${toastTitles(ctx)}`);
        await sleep(200);
        assert.ok(!alive(pid), "Stop ends the verified group");
        assert.ok(!existsSync(join(ctx.supportPath, "session.json")), "Stop deletes the record");
        assert.equal(sections(ctx)[0].title, "Sounds", "the Now playing row goes away");
      },
    });
  } finally {
    if (alive(pid)) process.kill(-pid, "SIGKILL");
  }
}

async function flowFailureRow() {
  const home = makeHome(["rain.m4a"]);
  const file = join(soundsIn(home), "rain.m4a");
  return run("play-sound", {
    home,
    records: { "failure.json": { token: "f".repeat(32), file, code: 1, at: 1 } },
    interact: async (ctx) => {
      assert.deepEqual(sections(ctx)[0], { title: "Now playing", rows: ["rain stopped (The player failed 3 times (exit 1))"] });
      assert.ok(!readdirSync(ctx.supportPath).includes("failure.json"), "the list deletes the marker once shown");
    },
  });
}

async function flowStopWithNothing() {
  return run("stop-sound", { interact: async (ctx) => {
    assert.deepEqual(huds(ctx), ["Nothing plays"]);
  }});
}

async function flowStaleRecordSendsNoSignal() {
  // PID 1 never carries the token, so the record is stale: deleted, no signal.
  return run("stop-sound", {
    records: { "session.json": { pid: 1, pgid: 1, token: "e".repeat(32), file: "/x.m4a", startedAt: 1 } },
    interact: async (ctx) => {
      assert.deepEqual(huds(ctx), ["Nothing plays"]);
      assert.ok(!existsSync(join(ctx.supportPath, "session.json")), "the stale record is deleted");
    },
  });
}

async function flowToggleWithNoLastSound() {
  return run("toggle-sound", { interact: async (ctx) => {
    assert.deepEqual(huds(ctx), ["No last sound. Pick one in Play Noise."]);
    assert.ok(!existsSync(join(ctx.supportPath, "session.json")), "nothing starts");
  }});
}

async function flowToggleWithMissingFile() {
  const home = makeHome();
  return run("toggle-sound", {
    home,
    records: { "last.json": { file: join(soundsIn(home), "gone.m4a") } },
    interact: async (ctx) => {
      assert.deepEqual(huds(ctx), ["Cannot play gone. Pick a sound in Play Noise."]);
      assert.ok(!existsSync(join(ctx.supportPath, "session.json")), "nothing starts");
    },
  });
}

export const FLOWS = [
  flowEmptyState,
  flowSeededSections,
  flowNowPlayingRow,
  flowFailureRow,
  flowStopWithNothing,
  flowStaleRecordSendsNoSignal,
  flowToggleWithNoLastSound,
  flowToggleWithMissingFile,
];
