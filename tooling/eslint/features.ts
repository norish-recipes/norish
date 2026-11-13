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

// A path and everything under it.
const andBelow = (pattern: string) => [pattern, `${pattern}/**`];

// Matches every alias and relative path to a feature or into one: @/features/x, ../features/x/y.
const anyFeature = andBelow("**/features/*");

// Imports run one way: shared code, then features, then routes. Only route files import a feature,
// and a feature imports no other: a panel several features open lives in the shared folders.
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
      ignores: [...routeFiles, `${featuresDir}/**`],
      rules: restrict(anyFeature, "Only route files import from a feature."),
    },
    ...features.map((feature) => ({
      files: [`${featuresDir}/${feature}/**/*.{js,ts,tsx}`],
      rules: restrict(
        [
          ...anyFeature,
          ...andBelow(`!**/features/${feature}`),
          // A relative path from one feature into a sibling never names features/.
          ...features
            .filter((other) => other !== feature)
            .flatMap((other) => andBelow(`**/../${other}`)),
        ],
        "A feature never imports another; code two features use goes in the shared folders."
      ),
    }))
  );
};

// A shared-react folder as a relative path or the package's own name reaches it.
const domainPaths = (domain: string) => [
  ...andBelow(`**/../${domain}`),
  ...andBelow(`@norish/shared-react/${domain}`),
];

// shared-react: a domain imports no other domain, and a cross-cutting folder imports no domain.
// Every other folder in srcDir is a domain.
export const restrictDomains = (
  root: string,
  options: { srcDir: string; crossCutting: string[] }
) => {
  const { srcDir, crossCutting } = options;
  const domains = readdirSync(path.join(root, srcDir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !crossCutting.includes(name));

  return defineConfig(
    { plugins: { features: plugin } },
    {
      files: crossCutting.map((folder) => `${srcDir}/${folder}/**/*.{ts,tsx}`),
      rules: restrict(
        domains.flatMap(domainPaths),
        "A cross-cutting folder imports only other cross-cutting folders."
      ),
    },
    ...domains.map((domain) => ({
      files: [`${srcDir}/${domain}/**/*.{ts,tsx}`],
      rules: restrict(
        domains.filter((other) => other !== domain).flatMap(domainPaths),
        "A domain imports only itself and cross-cutting folders."
      ),
    }))
  );
};

// Both apps: a component reads and writes through named shared-react hooks, never tRPC itself.
// An exception names its file, relative to the app, with one line of why.
export const restrictTRPC = (exceptions: Record<string, string> = {}) =>
  defineConfig(
    { plugins: { trpc: plugin } },
    {
      files: ["**/*.{js,ts,tsx}"],
      ignores: Object.keys(exceptions),
      rules: {
        "trpc/no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@norish/shared-react/trpc",
                importNames: ["useTRPC", "useTRPCClient"],
                message: "Call tRPC through a named hook in the shared-react domain it reads.",
              },
            ],
          },
        ],
      },
    }
  );
