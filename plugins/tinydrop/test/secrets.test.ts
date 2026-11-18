import { SECURITY } from "@tinycast/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Keychain tool (SECURITY) over an in-memory keychain, keyed "service/account".
const store = new Map<string, string>();
const calls: string[][] = [];

function words(line: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  for (const m of line.matchAll(re)) out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, "$1") : m[2]);
  return out;
}

function option(args: string[], flag: string): string {
  return args[args.indexOf(flag) + 1];
}

vi.mock("node:child_process", () => ({
  spawnSync: (file: string, args: string[], options: { input?: string }) => {
    expect(file).toBe(SECURITY);
    const line = args[0] === "-i" ? words(options.input ?? "") : args;
    calls.push(line);
    const key = `${option(line, "-s")}/${option(line, "-a")}`;
    if (args[0] === "-i") {
      store.set(key, option(line, "-w"));
      return { status: 0, stdout: "", stderr: "" };
    }
    if (args[0] === "find-generic-password") {
      return store.has(key) ? { status: 0, stdout: `${store.get(key)}\n`, stderr: "" } : { status: 44, stdout: "", stderr: "not found" };
    }
    return store.delete(key) ? { status: 0, stdout: "", stderr: "" } : { status: 44, stdout: "", stderr: "not found" };
  },
}));

const { KEYCHAIN_SERVICE, deleteToken, getAuth, saveToken } = await import("../src/auth/secrets");

beforeEach(() => {
  store.clear();
  calls.length = 0;
});

describe("secrets", () => {
  it("uses its own Keychain service, tinydrop, for every call", async () => {
    expect(KEYCHAIN_SERVICE).toBe("tinydrop");
    await saveToken("  tok-123  ");
    expect([...store.keys()]).toEqual(["tinydrop/test-token"]);
    expect(await getAuth()).toEqual({ token: "tok-123" });
    await deleteToken();
    expect(await getAuth()).toEqual({ token: undefined });
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls.map((line) => option(line, "-s")))).toEqual(new Set(["tinydrop"]));
  });
});
