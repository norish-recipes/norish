import { defineConfig } from "eslint/config";

import { baseConfig } from "@norish/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
);
