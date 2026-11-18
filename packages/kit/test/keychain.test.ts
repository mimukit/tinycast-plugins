import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Keychain tool over an in-memory keychain, keyed "service/account". It reads
// `security -i` lines the way the real tool does: split on spaces, with "…", \" and \\.
const store = new Map<string, string>();
const calls: { file: string; args: string[] }[] = [];
let failWrites = false;
let deleteStatus: number | undefined;

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
    calls.push({ file, args });
    const key = `${option(args, "-s")}/${option(args, "-a")}`;
    switch (args[0]) {
      case "-i": {
        const line = words(options.input ?? "");
        if (!failWrites) store.set(`${option(line, "-s")}/${option(line, "-a")}`, option(line, "-w"));
        return { status: 0, stdout: "", stderr: "" };
      }
      case "find-generic-password":
        return store.has(key) ? { status: 0, stdout: `${store.get(key)}\n`, stderr: "" } : { status: 44, stdout: "", stderr: "not found" };
      case "delete-generic-password":
        if (deleteStatus !== undefined) return { status: deleteStatus, stdout: "", stderr: "denied" };
        return store.delete(key) ? { status: 0, stdout: "", stderr: "" } : { status: 44, stdout: "", stderr: "not found" };
      default:
        return { status: 1, stdout: "", stderr: "unknown" };
    }
  },
}));

const { SECURITY, addCommand, createKeychain, quoteArg } = await import("../src/keychain");

beforeEach(() => {
  store.clear();
  calls.length = 0;
  failWrites = false;
  deleteStatus = undefined;
});

describe("createKeychain", () => {
  it("runs /usr/bin/security", async () => {
    createKeychain({ service: "svc" }).read("a");
    expect(SECURITY).toBe("/usr/bin/security");
    expect(calls.map((c) => c.file)).toEqual([SECURITY]);
  });

  it("keeps each service apart", () => {
    const one = createKeychain({ service: "one" });
    const two = createKeychain({ service: "two" });
    one.write("acct", "secret-1");
    expect(one.read("acct")).toBe("secret-1");
    expect(two.read("acct")).toBeUndefined();
    expect([...store.keys()]).toEqual(["one/acct"]);
  });

  it("reads with find-generic-password -w and returns undefined when no item matches", () => {
    const k = createKeychain({ service: "svc" });
    expect(k.read("missing")).toBeUndefined();
    expect(calls[0].args).toEqual(["find-generic-password", "-s", "svc", "-a", "missing", "-w"]);
  });

  it("sends the secret on stdin, never as an argument", () => {
    createKeychain({ service: "svc" }).write("acct", "tok-123");
    expect(calls.flatMap((c) => c.args).join(" ")).not.toContain("tok-123");
    expect(calls[0].args).toEqual(["-i"]);
  });

  it("rejects a control character", () => {
    expect(() => createKeychain({ service: "svc" }).write("acct", "a\nb")).toThrow(/control character/);
    expect(calls).toEqual([]);
  });

  it("fails when the item does not read back", () => {
    failWrites = true;
    expect(() => createKeychain({ service: "svc" }).write("acct", "tok")).toThrow(/Could not save/);
  });

  it("removes an item, and a missing item is not an error", () => {
    const k = createKeychain({ service: "svc" });
    k.write("acct", "tok");
    k.remove("acct");
    k.remove("acct");
    expect(store.size).toBe(0);
  });

  it("throws when a delete fails for another reason", () => {
    deleteStatus = 51;
    expect(() => createKeychain({ service: "svc" }).remove("acct")).toThrow(/Could not delete from the Keychain \(51\)/);
  });
});

describe("addCommand", () => {
  it("quotes spaces, quotes and backslashes", () => {
    expect(quoteArg('a b"c\\d')).toBe('"a b\\"c\\\\d"');
    expect(addCommand("svc", "acct", 'a b"c\\d$e')).toBe('add-generic-password -U -s "svc" -a "acct" -w "a b\\"c\\\\d$e"\n');
  });

  it("stores a secret with spaces, quotes and backslashes as written", () => {
    const k = createKeychain({ service: "svc" });
    const secret = 'a b"c\\d$e';
    k.write("acct", secret);
    expect(k.read("acct")).toBe(secret);
  });
});
