// Smoke test: drives tinytick's built bundles through Tinycast's own JavaScript
// runtime (the Raycast shim and React reconciler Tinycast ships), with a fake
// TickTick server. It checks the requests each flow sends. The harness is
// @tinycast/smoke (packages/smoke).
//
//   git clone --depth 1 https://github.com/abue-ammar/tinycast ../tinycast   # run in the repo root
//   pnpm build && pnpm smoke [<tinycast-checkout>]
//
// The checkout is the first argument, else TINYCAST_DIR, else ../tinycast beside
// the repo root.
//
// The Swift renderer is not covered. Run the QA plan in Tinycast for that.
//
// smoke/server.mjs is the fake TickTick server and its data, smoke/harness.mjs
// the setup, smoke/flows.mjs the flows in run order.
import { FLOWS } from "./flows.mjs";
import { main } from "./harness.mjs";

await main(FLOWS);
