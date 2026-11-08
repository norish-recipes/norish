import { readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "eslint/config";

import { baseConfig } from "../../tooling/eslint/base.ts";
import { reactConfig } from "../../tooling/eslint/react.ts";

const features = readdirSync(path.join(import.meta.dirname, "src/features"));

// Imports run one way: shared folders, then features, then src/app routes.
const restrictFeatures = (blocked: string[], message: string) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: blocked.map((feature) => `@/features/${feature}/**`),
          message,
        },
      ],
    },
  ],
});

export default defineConfig(
  {
    ignores: [".expo/**", "ios/**", "android/**"],
  },
  baseConfig,
  reactConfig,
  {
    // Kept off from the app's old Expo config: the boot, auth and network providers
    // still sync state in effects. Turn it on when the redesign rewrites them.
    rules: { "@eslint-react/set-state-in-effect": "off" },
  },
  {
    files: ["src/components/**", "src/hooks/**", "src/lib/**"],
    rules: restrictFeatures(features, "Shared code never imports a feature."),
  },
  ...features.map((feature) => ({
    files: [`src/features/${feature}/**`],
    rules: restrictFeatures(
      features.filter((other) => other !== feature),
      "A feature never imports another feature; compose them in src/app."
    ),
  }))
);
