import base from "@tinycast/config/vitest.base";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(base, defineConfig({}));
