import * as path from "node:path";

import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import turboPlugin from "eslint-plugin-turbo";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export const restrictEnvAccess = defineConfig(
  { ignores: ["**/env.ts"] },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          name: "process",
          importNames: ["env"],
          message: "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
      ],
    },
  },
);

export const baseConfig = defineConfig(
  includeIgnoreFile(path.join(import.meta.dirname, "../../.gitignore")),
  {
    ignores: [
      ".now/*",
      "**/*.css",
      "**/.changeset",
      "**/dist",
      "**/dist-server",
      "esm/*",
      "public/*",
      "tests/*",
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
      import: importPlugin,
      turbo: turboPlugin,
      "unused-imports": unusedImports,
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...turboPlugin.configs.recommended.rules,
      "no-console": "warn",
      "no-unused-vars": "off",
      "unused-imports/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
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
      "import/order": [
        "warn",
        {
          groups: ["type", "builtin", "object", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [
            {
              pattern: "~/**",
              group: "external",
              position: "after",
            },
          ],
          "newlines-between": "always",
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
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
);
