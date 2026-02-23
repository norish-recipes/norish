import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@norish/eslint-config/base";
import { nextjsConfig } from "@norish/eslint-config/nextjs";
import { reactConfig } from "@norish/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
