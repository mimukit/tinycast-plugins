// Smoke test: drives tinydrop's built bundles through Tinycast's own JavaScript
// runtime (the Raycast shim and React reconciler Tinycast ships), with a fake
// Raindrop server. The harness is @tinycast/smoke (packages/smoke).
//
//   git clone --depth 1 https://github.com/abue-ammar/tinycast ../tinycast   # run in the repo root
//   pnpm build && pnpm smoke [<tinycast-checkout>]
//
// The checkout is the first argument, else TINYCAST_DIR, else ../tinycast beside
// the repo root.
//
// sqlite3 runs for real, on a database in a temp supportPath. /usr/bin/security
// is answered from memory, so the run never touches a Keychain (and works on
// Linux, which has none). The Swift renderer is not covered.
//
// smoke/server.mjs is the fake Raindrop server, smoke/harness.mjs the setup and
// the SQLite seeding, smoke/flows.mjs the flows in run order.
import { FLOWS } from "./flows.mjs";
import { main } from "./harness.mjs";

await main(FLOWS);
