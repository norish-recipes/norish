import { readdirSync } from "node:fs";
import path from "node:path";
import type { ESLint, Linter } from "eslint";
import { defineConfig } from "eslint/config";
import { builtinRules } from "eslint/use-at-your-own-risk";

// The core rule registered a second time, so restrictEnvAccess's no-restricted-imports keeps its config.
const noRestrictedImports = builtinRules.get("no-restricted-imports");
if (!noRestrictedImports) throw new Error("ESLint no longer ships no-restricted-imports");
const plugin: ESLint.Plugin = { rules: { "no-restricted-imports": noRestrictedImports } };

const restrict = (group: string[], message: string): Linter.RulesRecord => ({
  "features/no-restricted-imports": ["error", { patterns: [{ group, message }] }],
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
    { plugins: { features: plugin } },
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
