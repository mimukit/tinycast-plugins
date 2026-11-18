// The fake Raindrop server and its data for the tinydrop smoke run.

export const API = "https://api.raindrop.io/rest/v1";

// ─── Fake Raindrop ──────────────────────────────────────────────────

export const USER = { _id: 7, fullName: "Test User", email: "test@example.com", pro: false, groups: [{ title: "My", collections: [11] }] };
export const COLLECTIONS = [{ _id: 11, title: "Dev", sort: 0, count: 2 }];
export const CHILDREN = [{ _id: 12, title: "Rust", parent: { $id: 11 }, sort: 0, count: 1 }];
export const BOOKMARKS = [
  {
    _id: 101, link: "https://doc.rust-lang.org/book/", title: "Rust ownership explained", domain: "doc.rust-lang.org",
    type: "article", tags: ["rust", "read"], collection: { $id: 12 }, created: "2026-10-01T00:00:00.000Z",
    lastUpdate: "2026-11-01T00:00:00.000Z", highlights: [{ _id: "h1", text: "borrow checker", note: "" }],
  },
  {
    _id: 102, link: "https://example.com/pasta", title: "Cooking pasta", domain: "example.com", type: "link",
    tags: [], collection: { $id: -1 }, important: true, created: "2026-10-02T00:00:00.000Z", lastUpdate: "2026-11-02T00:00:00.000Z",
  },
];
/** On the server only: an incremental sync picks it up. */
export const NEW_ON_SERVER = {
  _id: 103, link: "https://ziglang.org/comptime", title: "Zig comptime", domain: "ziglang.org", type: "article",
  tags: ["zig"], collection: { $id: 11 }, created: "2026-11-03T00:00:00.000Z", lastUpdate: "2026-11-03T00:00:00.000Z",
};
/** In the seeded store and in the server's Trash: a sync removes it. */
export const TRASHED = {
  _id: 104, link: "https://example.com/old", title: "Old trashed page", domain: "example.com", type: "link",
  tags: [], collection: { $id: -99 }, created: "2026-09-01T00:00:00.000Z", lastUpdate: "2026-11-04T00:00:00.000Z",
};
export const SERVER_BOOKMARKS = [...BOOKMARKS, NEW_ON_SERVER];
export const SERVER_TRASH = [TRASHED];
/** The sync mark of a seeded store that synced before: older than 103, newer than 101. */
export const SYNCED_MARK = "2026-11-01T12:00:00.000Z";
/** Tokens the fake server accepts. Any other token gets a 401. */
export const GOOD_TOKENS = new Set(["tok", "new-token"]);

/**
 * The fake Raindrop API. `server.items` adds bookmarks the server holds (cleanup flows).
 * `server.links` answers every request outside the API, as a link check sends it: a map from
 * URL to `(method) => ({ status, url? })`, which may throw to act as a network error. Each such
 * request goes to `linkCalls` as "METHOD url"; a URL with no entry gets a thrown error.
 */
export function fakeRaindrop(calls, server = {}, linkCalls = []) {
  // Each run gets its own copy of the server bookmarks, so a PUT reply carries the earlier writes.
  const items = new Map([...SERVER_BOOKMARKS, ...(server.items ?? [])].map((b) => [b._id, structuredClone(b)]));
  return async ([spec]) => {
    if (!spec.url.startsWith(API)) {
      linkCalls.push(`${spec.method} ${spec.url}`);
      const answer = server.links?.[spec.url];
      if (!answer) throw new Error(`fake link server: no answer for ${spec.url}`);
      const { status, url } = await answer(spec.method, spec.headers ?? {});
      return { status, statusText: String(status), headers: { "content-type": "text/html" }, url: url ?? spec.url, bodyBase64: "" };
    }
    const url = new URL(spec.url);
    url.searchParams.delete("_");
    const path = url.href.replace(API, "");
    const body = spec.bodyBase64 ? JSON.parse(Buffer.from(spec.bodyBase64, "base64").toString()) : undefined;
    const auth = spec.headers?.Authorization ?? spec.headers?.authorization ?? "";
    calls.push(`${spec.method} ${path}${body ? " " + JSON.stringify(body) : ""}`);
    const reply = (status, json) => ({
      status, statusText: status === 200 ? "OK" : "Error", headers: { "content-type": "application/json" }, url: spec.url,
      bodyBase64: Buffer.from(JSON.stringify(json)).toString("base64"),
    });
    if (!GOOD_TOKENS.has(auth.replace(/^Bearer /, ""))) return reply(401, { result: false, error: "Unauthorized" });
    const p = url.pathname.replace("/rest/v1", "");
    if (p === "/import/url/parse") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (url.searchParams.get("url")?.includes("/failure")) return reply(200, { result: false });
      return reply(200, { result: true, item: { title: "Fetched title", excerpt: "Fetched description" } });
    }
    if (p === "/user") return reply(200, { result: true, user: USER });
    // Bulk trash and restore, as Phase 1 verified them: the path collection filters the IDs.
    const bulk = p.match(/^\/raindrops\/(-?\d+)$/);
    if (bulk && (spec.method === "DELETE" || spec.method === "PUT") && Array.isArray(body?.ids)) {
      const from = Number(bulk[1]);
      const to = spec.method === "DELETE" ? -99 : body.collection?.$id;
      if (spec.method === "DELETE" && (from === -99 || from === 0)) return reply(400, { result: false, error: "fake server: refused bulk delete" });
      let modified = 0;
      for (const id of body.ids) {
        const item = items.get(id);
        if (item && item.collection.$id === from && typeof to === "number") {
          item.collection = { $id: to };
          modified++;
        }
      }
      return reply(200, { result: true, matched: modified, modified });
    }
    const page = Number(url.searchParams.get("page") ?? 0), perpage = Number(url.searchParams.get("perpage") ?? 50);
    const pageOf = (items) => ({ result: true, items: items.slice(page * perpage, (page + 1) * perpage), count: items.length });
    if (p === "/raindrops/0") {
      const sorted = [...SERVER_BOOKMARKS].sort((a, b) => Date.parse(b.lastUpdate) - Date.parse(a.lastUpdate));
      return reply(200, pageOf(sorted));
    }
    if (p === "/raindrops/-99") {
      const cutoff = (url.searchParams.get("search") ?? "").match(/^lastUpdate:>(\d{4}-\d{2}-\d{2})$/)?.[1] ?? "";
      return reply(200, pageOf(SERVER_TRASH.filter((b) => b.lastUpdate > cutoff)));
    }
    if (p === "/collections") return reply(200, { result: true, items: COLLECTIONS });
    if (p === "/collections/childrens") return reply(200, { result: true, items: CHILDREN });
    if (p === "/tags/0") return reply(200, { result: true, items: [{ _id: "rust", count: 1 }, { _id: "read", count: 1 }] });
    if (p === "/raindrop" && spec.method === "POST") {
      // As pleaseParse would: a title and a domain from the page.
      const { pleaseParse: _parse, ...fields } = body ?? {};
      const host = (() => { try { return new URL(fields.link).hostname; } catch { return ""; } })();
      return reply(200, {
        result: true, item: {
          _id: 900, collection: { $id: -1 }, type: "link", created: "2026-11-05T00:00:00.000Z", lastUpdate: "2026-11-05T00:00:00.000Z",
          ...fields, title: fields.title || "Example Domain", domain: host,
        }
      });
    }
    const one = p.match(/^\/raindrop\/(\d+)$/);
    if (one) {
      const found = items.get(Number(one[1]));
      if (!found) return reply(404, { result: false });
      if (spec.method === "PUT") {
        Object.assign(found, body);
        return reply(200, { result: true, item: found });
      }
      if (spec.method === "DELETE") return reply(200, { result: true });
      return reply(200, { result: true, item: found });
    }
    return reply(404, { result: false, error: `fake server: no route for ${spec.method} ${p}` });
  };
}
