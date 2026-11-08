import { readdirSync } from "node:fs";
import path from "node:path";
import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";

// typescript-eslint's copy of no-restricted-imports, so the core rule keeps restrictEnvAccess's ban.
const restrict = (group: string[], message: string): Linter.RulesRecord => ({
  "@typescript-eslint/no-restricted-imports": ["error", { patterns: [{ group, message }] }],
});

// Matches every alias and relative path into a feature: @/features/x/y, ../features/x/y.
const insideFeature = "**/features/*/**";

// Imports run one way: shared code, then features, then routes. Route files import anything from
// a feature, other files in appDir and other features only its index.ts, shared code nothing.
export const restrictFeatures = (
  root: string,
  options: { featuresDir: string; appDir: string; routeFiles: string[] }
) => {
  const { featuresDir, appDir, routeFiles } = options;
  const features = readdirSync(path.join(root, featuresDir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return defineConfig(
    {
      files: ["**/*.{js,ts,tsx}"],
      ignores: [`${appDir}/**`, `${featuresDir}/**`],
      rules: restrict(["**/features/*"], "Shared code never imports a feature."),
    },
    {
      files: [`${appDir}/**/*.{js,ts,tsx}`],
      ignores: routeFiles,
      rules: restrict(
        [insideFeature],
        "Import a feature through its index.ts; only route files import from inside one."
      ),
    },
    ...features.map((feature) => ({
      files: [`${featuresDir}/${feature}/**/*.{js,ts,tsx}`],
      rules: restrict(
        [
          insideFeature,
          `!**/features/${feature}/**`,
          // A relative path from one feature into a sibling never names features/.
          ...features.filter((other) => other !== feature).map((other) => `**/../${other}/**`),
        ],
        "Import another feature through its index.ts."
      ),
    }))
  );
};
