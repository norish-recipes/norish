import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "../../tooling/eslint/base.ts";
import { nextjsConfig } from "../../tooling/eslint/nextjs.ts";
import { reactConfig } from "../../tooling/eslint/react.ts";

export default defineConfig(
  {
    // The .results dirs hold Playwright output (traces carry .js resources);
    // they appear and vanish while suites run, so walking them crashes eslint.
    ignores: [".next/**", "e2e/.results/**", "e2e-ai/.results/**", "e2e-ai/.runtime/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
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
