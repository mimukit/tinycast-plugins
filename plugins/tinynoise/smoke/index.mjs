// Smoke test: drives tinynoise's built bundles through Tinycast's own JavaScript
// runtime (the Raycast shim and React reconciler Tinycast ships). The harness is
// @tinycast/smoke (packages/smoke).
//
//   git clone --depth 1 https://github.com/abue-ammar/tinycast ../tinycast   # run in the repo root
//   pnpm build && pnpm smoke [<tinycast-checkout>]
//
// The checkout is the first argument, else TINYCAST_DIR, else ../tinycast beside
// the repo root.
//
// Each run gets a temp home folder (so ~/Music/Tinynoise is a temp folder) and a
// temp supportPath. No flow plays audio: the "Now playing" flow seeds a session
// whose loop is a plain `sleep` that the flow starts itself.
//
// The Swift renderer and real playback are not covered. Run the QA plan in
// Tinycast for those.
//
// smoke/harness.mjs is the setup, smoke/flows.mjs the flows in run order.
import { FLOWS } from "./flows.mjs";
import { main } from "./harness.mjs";

await main(FLOWS);
