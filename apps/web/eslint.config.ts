import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "../../tooling/eslint/base.ts";
import { nextjsConfig } from "../../tooling/eslint/nextjs.ts";
import { reactConfig } from "../../tooling/eslint/react.ts";

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
    // The E2E suites are Node/Playwright code that happens to live in a React
    // app, so three rules aimed at the app itself misfire here.
    files: ["__tests__/e2e/**/*.ts"],
    rules: {
      // Playwright names its fixture callback `use`, and the React Hooks rule
      // reads every call of it as the `use` hook. Nothing here is a component.
      "react-hooks/rules-of-hooks": "off",
      // `async ({}, use) => {}` is how a fixture declares it takes no fixtures.
      "no-empty-pattern": "off",
      // The harness composes the environment of a real server child process,
      // which is upstream of the app's validated `~/env` rather than a bypass.
      "no-restricted-properties": "off",
    },
  },
  {
    // app/sw.ts is excluded from tsconfig.json (it typechecks against webworker
    // libs via tsconfig.sw.json), so the project service can't place it; let it
    // lint under the default project instead of erroring.
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["app/sw.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
