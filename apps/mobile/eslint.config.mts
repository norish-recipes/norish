import { defineConfig } from "eslint/config";

import { baseConfig } from "../../tooling/eslint/base.ts";
import { restrictFeatures } from "../../tooling/eslint/features.ts";
import { compiledReactConfig, reactConfig } from "../../tooling/eslint/react.ts";

export default defineConfig(
  {
    ignores: [".expo/**", "ios/**", "android/**"],
  },
  baseConfig,
  reactConfig,
  compiledReactConfig,
  {
    // Kept off from the app's old Expo config: the boot, auth and network providers
    // still sync state in effects. Turn it on when the redesign rewrites them.
    rules: { "@eslint-react/set-state-in-effect": "off" },
  },
  // Expo Router makes every file under src/app a route.
  restrictFeatures(import.meta.dirname, {
    featuresDir: "src/features",
    appDir: "src/app",
    routeFiles: ["src/app/**"],
  })
);
