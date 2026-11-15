import { defineConfig } from "eslint/config";

import { baseConfig } from "../../tooling/eslint/base.ts";
import { compiledReactConfig, reactConfig } from "../../tooling/eslint/react.ts";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
  compiledReactConfig
);
