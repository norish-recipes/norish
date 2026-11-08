import * as path from "node:path";
import eslint from "@eslint/js";
import turboPlugin from "eslint-plugin-turbo";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import { sonarjsConfig } from "./sonarjs.ts";

const turboRecommendedRules =
  (
    turboPlugin as {
      configs?: {
        recommended?: {
          rules?: Record<string, unknown>;
        };
      };
    }
  ).configs?.recommended?.rules ?? {};

export const restrictEnvAccess = defineConfig(
  { ignores: ["**/env.ts"] },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-properties": [
        "warn",
        {
          object: "process",
          property: "env",
          message: "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
      ],
      "no-restricted-imports": [
        "warn",
        {
          name: "process",
          importNames: ["env"],
          message: "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
      ],
    },
  }
);

export const baseConfig = defineConfig(
  includeIgnoreFile(path.join(import.meta.dirname, "../../.gitignore")),
  {
    ignores: [
      ".now/*",
      "**/*.css",
      "**/.changeset",
      "**/dist",
      "esm/*",
      "public/*",
      "tests/*",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "scripts/*",
      "**/*.config.*",
      "**/.DS_Store",
      "**/node_modules",
      "**/coverage",
      "**/.next",
      "**/build",
      "lib/logger.ts",
      "!**/.commitlintrc.cjs",
      "!**/.lintstagedrc.cjs",
      "!**/jest.config.js",
      "!**/plopfile.js",
      "!**/react-shim.js",
      "!**/tsup.config.ts",
    ],
  },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    plugins: {
      turbo: turboPlugin,
      "unused-imports": unusedImports,
    },
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...turboRecommendedRules,
      "turbo/no-undeclared-env-vars": "off",
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
      "no-empty": "off",
      "unused-imports/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          ignoreRestSiblings: false,
          argsIgnorePattern: "^_.*?$",
          varsIgnorePattern: "^_.*?$",
          caughtErrorsIgnorePattern: "^_.*?$",
        },
      ],
      "padding-line-between-statements": [
        "warn",
        {
          blankLine: "always",
          prev: "*",
          next: "return",
        },
        {
          blankLine: "always",
          prev: ["const", "let", "var"],
          next: "*",
        },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
      ],
    },
  },
  sonarjsConfig,
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  }
);
