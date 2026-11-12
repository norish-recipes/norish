import { defineConfig } from "eslint/config";

import { baseConfig } from "../../tooling/eslint/base.ts";
import { restrictDomains } from "../../tooling/eslint/features.ts";
import { compiledReactConfig, reactConfig } from "../../tooling/eslint/react.ts";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
  compiledReactConfig,
  restrictDomains(import.meta.dirname, {
    srcDir: "src",
    crossCutting: ["trpc", "platform", "offline", "config", "reader", "realtime", "page-store"],
  })
);
