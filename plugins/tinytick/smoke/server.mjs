// The fake TickTick server and its data for the tinytick smoke run.

export const fmt = (d) => { const p=(n)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00.000+0000`; };
export const today = new Date(); today.setHours(0,0,0,0);
export const yesterday = new Date(today.getTime() - 86400000);
export const tasks = [
  { id: "a1", projectId: "p1", title: "Pay rent", status: 0, priority: 5, dueDate: fmt(today), isAllDay: true, tags: ["money"] },
  { id: "a2", projectId: "p2", title: "Write report", status: 0, priority: 1, dueDate: fmt(yesterday), isAllDay: true,
    items: [{ id: "i1", title: "Outline", status: 1, sortOrder: 0 }, { id: "i2", title: "Draft", status: 0, sortOrder: 1 }] },
  { id: "a3", projectId: "inbox9", title: "Inbox thing", status: 0 },
];
export const snapshot = { version: 1, syncedAt: Date.now(), source: "open", inboxId: "inbox9",
  projects: [{ id: "p1", name: "Personal" }, { id: "p2", name: "Work" }], groups: [], tags: [{ name: "money" }], tasks };

export function fakeServer(calls) {
  return async ([spec]) => {
    const path = spec.url.replace("https://api.ticktick.com", "");
    const body = spec.bodyBase64 ? JSON.parse(Buffer.from(spec.bodyBase64, "base64").toString()) : undefined;
    calls.push(`${spec.method} ${path}${body ? " " + JSON.stringify(body) : ""}`);
    let reply = "";
    if (path.startsWith("/api/v2/batch/check/")) reply = JSON.stringify({ checkPoint: 77, inboxId: "inbox9", projectProfiles: snapshot.projects, tags: snapshot.tags, syncTaskBean: { update: tasks } });
    else if (path.startsWith("/api/v2/")) reply = "{}";
    else if (path === "/open/v1/project") reply = JSON.stringify(snapshot.projects);
    else if (path.endsWith("/data")) reply = JSON.stringify({ tasks: tasks.filter((t) => path.includes(t.projectId) || (path.includes("inbox") && t.projectId === "inbox9")) });
    else if (path === "/open/v1/tag") reply = JSON.stringify([{ name: "money" }]);
    else if (path === "/open/v1/task") reply = JSON.stringify({ id: "new1", projectId: body.projectId ?? "inbox9", ...body });
    else if (path === "/open/v1/task/completed") reply = JSON.stringify([{ id: "d1", projectId: "p1", title: "Done earlier", status: 2, completedTime: fmt(today) }]);
    else if (path.startsWith("/open/v1/task/") && spec.method === "POST") reply = JSON.stringify({ ...tasks.find((t) => path.endsWith(t.id)), ...body });
    else if (path === "/open/v1/task/completed") reply = JSON.stringify([{ id: "d1", projectId: "p1", title: "Done earlier", status: 2, completedTime: fmt(today) }]);
    return { status: 200, statusText: "OK", headers: { "content-type": "application/json" }, url: spec.url, bodyBase64: Buffer.from(reply).toString("base64") };
  };
}
