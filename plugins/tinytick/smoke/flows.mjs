// The tinytick smoke flows, in run order. Each flow is one async function in
// FLOWS; a new behavior adds one there. `ONLY=flowName pnpm smoke …` runs one flow.
import assert from "node:assert/strict";
import { choose, findAll, press, pressOn } from "@tinycast/smoke";
import { run } from "./harness.mjs";

const sent = (calls, re) => calls.some((c) => re.test(c));

/** The v2 options: the enableV2 preference and the v2-cookie Keychain item beside the API token. */
const v2 = () => ({ preferences: { enableV2: true }, keychain: { "api-token": "tok", "v2-cookie": "t=cookie123" } });

async function flowTaskWritesAndUndo() {
  return run("tasks", { interact: async (ctx) => {
    await pressOn(ctx, "Write report", "Set Priority…");
    await choose(ctx, "5");
    await pressOn(ctx, "Write report", "Set Date…");
    await choose(ctx, "Tomorrow");
    await press(ctx, "Complete");
    const undo = findAll(ctx.harness.state.trees.at(-1), (n) => /^Undo/.test(n.props?.title ?? ""))[0];
    assert.ok(undo, "an Undo action shows after a write");
    assert.deepEqual(undo.props.shortcut, { modifiers: ["cmd"], key: "z" });
    await press(ctx, undo.props.title);
    await press(ctx, "Show Completed");
    assert.ok(sent(ctx.calls, /^POST \/open\/v1\/task\/a2 \{"priority":5,"id":"a2","projectId":"p2"\}$/), "priority sends one field");
    assert.ok(sent(ctx.calls, /^POST \/open\/v1\/task\/a2 \{"dueDate":/), "date change sends dates");
    assert.ok(sent(ctx.calls, /^POST \/open\/v1\/project\/p1\/task\/a1\/complete$/), "complete");
    assert.ok(sent(ctx.calls, /^POST \/open\/v1\/task\/a1 \{"status":0/), "undo reopens");
    assert.ok(sent(ctx.calls, /^POST \/open\/v1\/task\/completed/), "show completed fetches");
  }});
}

async function flowChecklistItems() {
  return run("tasks", { interact: async (ctx) => {
    await pressOn(ctx, "Write report", "Open Task");
    await press(ctx, "Check");
    const list = findAll(ctx.harness.state.trees.at(-1), (n) => n.type === "List" && n.props?.onSearchTextChange?.$fn).at(-1);
    ctx.harness.dispatch("s1", list.props.onSearchTextChange.$fn, ["Proofread"]);
    await new Promise((r) => setTimeout(r, 300));
    await press(ctx, "Add Item");
    assert.ok(sent(ctx.calls, /"title":"Draft","status":1/), "check item");
    assert.ok(sent(ctx.calls, /"title":"Proofread","status":0,"sortOrder":2/), "add item");
  }});
}

async function flowGroupingAndShortcuts() {
  return run("tasks", { interact: async (ctx) => {
    const first = ctx.tree(); // the tree at launch, before the Group By change
    const sectionTitles = () => findAll(ctx.harness.state.trees.at(-1), (n) => n.type === "List.Section").map((n) => n.props.title);
    assert.ok(sectionTitles().every((t) => ["High", "Medium", "Low", "No Priority"].includes(t)), `grouped by priority by default: ${sectionTitles()}`);
    await pressOn(ctx, "Pay rent", "Group By…");
    await choose(ctx, "time");
    assert.equal(sectionTitles().at(-1), "Overdue", `Overdue is the last time section: ${sectionTitles()}`);
    const menu = findAll(first, (n) => n.type === "List.Item" && n.props.title === "Pay rent")[0];
    const actions = findAll(menu.props.actions, (n) => n.type === "Action");
    const titles = actions.map((n) => n.props.title);
    const keys = actions.map((n) => n.props.shortcut && `${n.props.shortcut.modifiers.join("+")}+${n.props.shortcut.key}`);
    for (const k of ["cmd+1", "cmd+2", "cmd+3", "ctrl+1", "ctrl+2", "ctrl+3"]) assert.ok(keys.includes(k), `row has the ${k} shortcut`);
    assert.ok(titles.length <= 25, `action panel stays short: ${titles.length}`);
    const labels = findAll(menu.props.detail, (n) => n.type === "Detail.Metadata.Label").map((n) => n.props.title);
    for (const t of ["List", "Date", "Priority"]) assert.ok(labels.includes(t), `the detail pane shows ${t}: ${labels}`);
    await pressOn(ctx, "Pay rent", "Priority Low");
    assert.ok(sent(ctx.calls, /"priority":1,/), "ctrl+3 sets low priority");
  }});
}

async function flowEditedRowHoldsPlace() {
  return run("tasks", { interact: async (ctx) => {
    // Tinycast keeps the highlight on a row number, so an edited row must not move until a refresh.
    const sectionOf = (row) =>
      findAll(ctx.harness.state.trees.at(-1), (n) => n.type === "List.Section")
        .find((s) => findAll(s, (n) => n.type === "List.Item" && n.props.title === row).length)?.props.title;
    assert.equal(sectionOf("Pay rent"), "High", "Pay rent starts in High");
    await pressOn(ctx, "Pay rent", "Priority Low");
    assert.equal(sectionOf("Pay rent"), "High", "an edited row holds its place");
    await pressOn(ctx, "Pay rent", "Refresh List");
    assert.equal(sectionOf("Pay rent"), "Low", "Refresh List re-groups the row");
  }});
}

async function flowSignedOut() {
  return run("tasks", { keychain: {}, interact: async (ctx) => {
    // Rows, not an EmptyView: Tinycast shows the ↵ and ⌘K pill only when a row is selected.
    const rows = findAll(ctx.tree(), (n) => n.type === "List.Item");
    assert.deepEqual(rows.map((r) => r.props.title), ["Sign in with an API token", "Open Account"], "sign-in rows");
    const first = (row) => findAll(row.props.actions, (n) => n.type === "Action")[0]?.props.title;
    assert.deepEqual(rows.map(first), ["Enter API Token", "Open Account"], "each row's primary action");
    await press(ctx, "Enter API Token");
    assert.ok(findAll(ctx.harness.state.trees.at(-1), (n) => n.type === "Form.PasswordField" && n.props.id === "token").length, "token form opens");
  }});
}

async function flowQuickAdd() {
  return run("add-task", { interact: async (ctx) => {
    const list = findAll(ctx.tree(), (n) => n.type === "List" && n.props?.onSearchTextChange?.$fn)[0];
    ctx.harness.dispatch("s1", list.props.onSearchTextChange.$fn, ["groceries tomorrow !med ~Wo :: milk; eggs"]);
    await new Promise((r) => setTimeout(r, 300));
    await press(ctx, "Add Task");
    assert.ok(sent(ctx.calls, /^POST \/open\/v1\/task \{"title":"groceries","projectId":"p2".*"priority":3,"kind":"CHECKLIST"/), "quick add body");
  }});
}

async function flowAddTaskArgument() {
  return run("add-task", { args: { text: "call bank tomorrow 3pm !high #admin ~Personal" }, interact: async (ctx) => {
    await press(ctx, "Add Task");
    assert.ok(sent(ctx.calls, /^POST \/open\/v1\/task \{"title":"call bank","projectId":"p1","isAllDay":false,"dueDate":"\d{4}-\d\d-\d\dT15:00:00.*"priority":5,"tags":\["admin"\]/), "one-line add body");
  }});
}

async function flowSyncNow() {
  return run("tasks", { interact: async (ctx) => {
    ctx.calls.length = 0;
    await press(ctx, "Sync Now");
    assert.equal(ctx.calls.filter((c) => c.startsWith("GET /open/v1/project/") && c.endsWith("/data")).length, 3, "inbox plus two lists");
  }});
}

async function flowViewDropdown() {
  return run("tasks", { interact: async (ctx) => {
    const dropdown = () => findAll(ctx.harness.state.trees.at(-1), (n) => n.type === "List.Dropdown")[0];
    const sections = findAll(dropdown(), (n) => n.type === "List.Dropdown.Section").map((n) => n.props.title);
    assert.equal(sections[0], "Views", `date views come first: ${sections}`);
    assert.equal(sections.at(-1), "Completed", `completed ranges come last: ${sections}`);
    const values = findAll(dropdown(), (n) => n.type === "List.Dropdown.Item").map((n) => n.props.value);
    assert.ok(values.includes("project:p1") && values.includes("completed:week"), `lists and completed ranges: ${values}`);
    ctx.harness.dispatch("s1", dropdown().props.onChange.$fn, ["project:p2"]);
    await new Promise((r) => setTimeout(r, 300));
    const titles = findAll(ctx.harness.state.trees.at(-1), (n) => n.type === "List.Item").map((n) => n.props.title);
    assert.ok(titles.length && !titles.includes("Pay rent"), `a list view shows that list only: ${titles}`);
    ctx.harness.dispatch("s1", dropdown().props.onChange.$fn, ["completed:week"]);
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(sent(ctx.calls, /^POST \/open\/v1\/task\/completed/), "a completed view fetches");
  }});
}

async function flowServerSearch() {
  return run("tasks", { interact: async (ctx) => {
    const list = findAll(ctx.tree(), (n) => n.type === "List" && n.props?.onSearchTextChange?.$fn)[0];
    assert.equal(list.props.filtering, true, "the search bar filters the rows");
    ctx.harness.dispatch("s1", list.props.onSearchTextChange.$fn, ["report"]);
    await new Promise((r) => setTimeout(r, 300));
    await press(ctx, "Search on Server");
    assert.ok(sent(ctx.calls, /search/i), `server search sends a request: ${ctx.calls}`);
  }});
}

async function flowAccount() {
  return run("tasks", { interact: async (ctx) => {
    await press(ctx, "Account");
    assert.ok(findAll(ctx.harness.state.trees.at(-1), (n) => n.type === "List" && n.props.navigationTitle === "TickTick Account").length, "account opens");
  }});
}

async function flowV2Sync() {
  return run("tasks", { ...v2(), interact: async (ctx) => {
    ctx.calls.length = 0;
    await press(ctx, "Sync Now");
    assert.deepEqual(ctx.calls, ["GET /api/v2/batch/check/0"], "v2 sync is one request");
  }});
}

async function flowV2PinAndWontDo() {
  return run("tasks", { ...v2(), interact: async (ctx) => {
    await press(ctx, "Pin");
    await press(ctx, "Won't Do");
    assert.ok(sent(ctx.calls, /^POST \/api\/v2\/batch\/task .*"pinnedTime"/), "pin");
    assert.ok(sent(ctx.calls, /^POST \/api\/v2\/batch\/task .*"status":-1/), "won't do");
  }});
}

async function flowNoV2Actions() {
  return run("tasks", { interact: async (ctx) => {
    assert.equal(findAll(ctx.tree(), (n) => n.props?.title === "Pin" || n.props?.title === "Won't Do").length, 0, "no v2 action with v2 off");
  }});
}

export const FLOWS = [
  flowTaskWritesAndUndo,
  flowChecklistItems,
  flowGroupingAndShortcuts,
  flowEditedRowHoldsPlace,
  flowSignedOut,
  flowQuickAdd,
  flowAddTaskArgument,
  flowSyncNow,
  flowViewDropdown,
  flowServerSearch,
  flowAccount,
  flowV2Sync,
  flowV2PinAndWontDo,
  flowNoV2Actions,
];
