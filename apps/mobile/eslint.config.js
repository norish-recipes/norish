// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

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
]);
