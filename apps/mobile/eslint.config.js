// https://docs.expo.dev/guides/using-eslint/
const fs = require("fs");
const path = require("path");
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

const features = fs.readdirSync(path.join(__dirname, "src/features"));

// Imports run one way: shared folders, then features, then src/app routes.
const restrictFeatures = (blocked, message) => ({
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

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
        node: {
          extensions: [
            ".android.js",
            ".android.jsx",
            ".android.ts",
            ".android.tsx",
            ".ios.js",
            ".ios.jsx",
            ".ios.ts",
            ".ios.tsx",
            ".native.js",
            ".native.jsx",
            ".native.ts",
            ".native.tsx",
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
            ".d.ts",
          ],
        },
      },
    },
  },
  {
    rules: {
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
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
  })),
]);
