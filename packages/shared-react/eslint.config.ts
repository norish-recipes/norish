import { defineConfig } from "eslint/config";

import { baseConfig } from "../../tooling/eslint/base.ts";
import { restrictDomains } from "../../tooling/eslint/features.ts";
import { reactConfig } from "../../tooling/eslint/react.ts";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
  restrictDomains(import.meta.dirname, {
    srcDir: "src",
    crossCutting: ["trpc", "platform", "offline", "config", "reader", "realtime"],
    // The by-type folders that empty out as domains move in; the rule skips them.
    legacy: ["hooks", "contexts"],
  })
);
