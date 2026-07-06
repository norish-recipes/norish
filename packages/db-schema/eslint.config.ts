import { defineConfig } from "eslint/config";

import { baseConfig } from "../../tooling/eslint/base.ts";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig
);
