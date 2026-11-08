import { readdirSync } from "node:fs";
import path from "node:path";
import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";

import { baseConfig, processEnvImport, restrictEnvAccess } from "../../tooling/eslint/base.ts";
import { nextjsConfig } from "../../tooling/eslint/nextjs.ts";
import { reactConfig } from "../../tooling/eslint/react.ts";

const features = readdirSync(path.join(import.meta.dirname, "features"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// Imports run one way: shared folders, then features, then app/ routes. Outside app/ and
// its own folder, a feature is imported only through its index.ts.
const restrictFeatures = (ownFeature?: string): Linter.RulesRecord => ({
  "no-restricted-imports": [
    "error",
    {
      // These options replace restrictEnvAccess's, so its process ban is repeated here.
      paths: [processEnvImport],
      patterns: [
        {
          group: ["@/features/*/**", ...(ownFeature ? [`!@/features/${ownFeature}/**`] : [])],
          message:
            "Import a feature through its index.ts; only app/ routes import from inside one.",
        },
      ],
    },
  ],
});

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
  {
    // baseConfig globally ignores "**/__tests__/**", which is right for the
    // unit suites. Browser E2E sources are production-facing harness code too;
    // without this negation their location under __tests__ would silently drop
    // the whole suite out of the Lint gate.
    //
    // The re-ignores must follow it: patterns are applied in order, so a bare
    // "!__tests__/e2e/**" would also pull the generated directories back in.
    // Playwright traces carry JavaScript resources, and walking them while a
    // suite is running can crash eslint.
    ignores: [
      "!__tests__",
      "!__tests__/e2e/**",
      "__tests__/e2e/.results/**",
      "__tests__/e2e/.runtime/**",
    ],
  },
  {
    // baseConfig ignores every workspace's scripts/; the measure scripts here are linted.
    ignores: ["!scripts/*"],
  },
  {
    // The E2E suites are Node/Playwright code that happens to live in a React
    // app, so three rules aimed at the app itself misfire here.
    files: ["__tests__/e2e/**/*.ts"],
    rules: {
      // Playwright names its fixture callback `use`, and the React Hooks rule
      // reads every call of it as the `use` hook. Nothing here is a component.
      "@eslint-react/rules-of-hooks": "off",
      // `async ({}, use) => {}` is how a fixture declares it takes no fixtures.
      "no-empty-pattern": "off",
      // The harness composes the environment of a real server child process,
      // which is upstream of the app's validated `~/env` rather than a bypass.
      "no-restricted-properties": "off",
    },
  },
  {
    // The service worker has its own type program (tsconfig.sw.json, with the
    // WebWorker lib), which the project service does not find for it.
    files: ["app/sw.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.sw.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // A skeleton's rows are placeholders: they have no identity and never
    // reorder, so their position is the only key they have.
    files: ["components/skeleton/**/*.tsx"],
    rules: { "@eslint-react/no-array-index-key": "off" },
  },
  {
    // The browser scenarios drive a harness served from localhost, which is a
    // secure context, and their `page.evaluate` bodies cannot import from the
    // app anyway. The secure-context restriction is about shipped client code.
    files: ["__tests__/e2e/**/*.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  { ignores: ["app/**"], rules: restrictFeatures() },
  ...features.map((feature) => ({
    files: [`features/${feature}/**`],
    rules: restrictFeatures(feature),
  }))
);
