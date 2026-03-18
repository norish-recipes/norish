import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";

export const nextjsConfig = defineConfig({
  files: ["**/*.ts", "**/*.tsx"],
  plugins: {
    "@next/next": nextPlugin,
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
    "@next/next/no-duplicate-head": "off",
  },
});
