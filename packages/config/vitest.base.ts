import { defineConfig } from "vitest/config";

// The Vitest settings both plugins share. A plugin merges its own settings on
// top with mergeConfig from "vitest/config".
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
