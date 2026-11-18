import { describe, expect, it } from "vitest";
import { WriteQueue } from "../src/queue";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("WriteQueue.run", () => {
  it("starts a write for a key only after the earlier one settles", async () => {
    const q = new WriteQueue();
    const order: string[] = [];
    const first = deferred();
    const a = q.run("k1", async () => {
      order.push("a start");
      await first.promise;
      order.push("a end");
    });
    const b = q.run("k1", async () => {
      order.push("b start");
    });
    await tick();
    expect(order).toEqual(["a start"]);
    expect(q.pending("k1")).toBe(2);
    first.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(["a start", "a end", "b start"]);
    expect(q.pending("k1")).toBe(0);
  });

  it("runs the next write when the earlier one fails, and keeps the failure for its caller", async () => {
    const q = new WriteQueue();
    const a = q.run("k1", async () => {
      throw new Error("boom");
    });
    const b = q.run("k1", async () => "ok");
    await expect(a).rejects.toThrow("boom");
    await expect(b).resolves.toBe("ok");
  });
});

describe("WriteQueue.runAll", () => {
  it("waits for the earlier writes on every key, and a later write on any key waits for it", async () => {
    const q = new WriteQueue();
    const order: string[] = [];
    const k1 = deferred();
    const k2 = deferred();
    const bulkDone = deferred();
    const a = q.run("k1", async () => {
      await k1.promise;
      order.push("k1 write");
    });
    const b = q.run("k2", async () => {
      await k2.promise;
      order.push("k2 write");
    });
    const bulk = q.runAll(["k1", "k2", "k2"], async () => {
      order.push("bulk start");
      await bulkDone.promise;
      order.push("bulk end");
    });
    const later = q.run("k2", async () => {
      order.push("later k2");
    });
    const other = q.run("k3", async () => {
      order.push("k3 write");
    });

    await tick();
    expect(order).toEqual(["k3 write"]);
    expect(q.pending("k1")).toBe(2);
    expect(q.pending("k2")).toBe(3);

    k1.resolve();
    await tick();
    expect(order).toEqual(["k3 write", "k1 write"]);

    k2.resolve();
    await tick();
    expect(order).toEqual(["k3 write", "k1 write", "k2 write", "bulk start"]);

    bulkDone.resolve();
    await Promise.all([a, b, bulk, later, other]);
    expect(order).toEqual(["k3 write", "k1 write", "k2 write", "bulk start", "bulk end", "later k2"]);
    expect(q.pending("k1")).toBe(0);
    expect(q.pending("k2")).toBe(0);
  });
});
