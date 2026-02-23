import { defineConfig } from "eslint/config";

import { baseConfig } from "@norish/eslint-config/base";
import { reactConfig } from "@norish/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
