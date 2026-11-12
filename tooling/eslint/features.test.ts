import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Linter } from "eslint";
import { afterAll, describe, expect, it } from "vitest";

import { restrictDomains, restrictFeatures } from "./features.ts";

const root = mkdtempSync(path.join(tmpdir(), "features-rule-"));

afterAll(() => rmSync(root, { recursive: true, force: true }));

function folders(...dirs: string[]) {
  for (const dir of dirs) mkdirSync(path.join(root, dir), { recursive: true });
}

/** The rule messages one import in `file` gets under `config`, both relative to `cwd`. */
function lint(cwd: string, config: Linter.Config[], file: string, from: string): string[] {
  // Every file matches some config, so one the rule leaves alone is linted, not skipped.
  const everyFile = { files: ["**/*.{ts,tsx}"] };

  return new Linter({ cwd })
    .verify(
      `import x from "${from}";\nexport default x;\n`,
      [everyFile, ...config],
      path.join(cwd, file)
    )
    .map(({ message }) =>
      message.replace(/^.* import is restricted from being used by a pattern\. /, "")
    );
}

describe("restrictDomains", () => {
  folders(
    "shared-react/src/groceries",
    "shared-react/src/recipes",
    "shared-react/src/trpc",
    "shared-react/src/offline/react"
  );
  const cwd = path.join(root, "shared-react");
  const config = restrictDomains(cwd, {
    srcDir: "src",
    crossCutting: ["trpc", "offline"],
  });
  const at = (file: string, from: string) => lint(cwd, config, `src/${file}`, from);

  it("stops a domain importing another, by path or package name", () => {
    expect(at("groceries/list.ts", "../recipes/detail")).toEqual([
      "A domain imports only itself and cross-cutting folders.",
    ]);
    expect(at("groceries/list.ts", "@norish/shared-react/recipes")).toHaveLength(1);
  });

  it("lets a domain import itself and cross-cutting folders", () => {
    expect(at("groceries/list.ts", "./row")).toEqual([]);
    expect(at("groceries/list.ts", "../trpc")).toEqual([]);
    expect(at("groceries/list.ts", "@norish/shared-react/offline")).toEqual([]);
  });

  it("stops a cross-cutting folder importing a domain", () => {
    expect(at("trpc/client.ts", "../groceries")).toEqual([
      "A cross-cutting folder imports only other cross-cutting folders.",
    ]);
    expect(at("offline/react/hook.ts", "../../recipes/detail")).toHaveLength(1);
    expect(at("offline/react/hook.ts", "@norish/shared-react/groceries")).toHaveLength(1);
  });

  it("lets a cross-cutting folder import another", () => {
    expect(at("offline/engine.ts", "../trpc")).toEqual([]);
  });
});

describe("restrictFeatures", () => {
  folders("web/features/groceries", "web/features/recipes", "web/app/groceries", "web/components");
  const cwd = path.join(root, "web");
  const config = restrictFeatures(cwd, {
    featuresDir: "features",
    appDir: "app",
    routeFiles: ["app/**/page.tsx"],
  });
  const at = (file: string, from: string) => lint(cwd, config, file, from);

  const shared = "Only route files import from a feature.";
  const sibling =
    "A feature never imports another; code two features use goes in the shared folders.";

  it("keeps shared code out of every feature", () => {
    expect(at("components/card.tsx", "@/features/groceries")).toEqual([shared]);
    expect(at("components/card.tsx", "@/features/groceries/screens/list")).toEqual([shared]);
    expect(at("components/card.tsx", "../features/recipes/screens/detail")).toHaveLength(1);
  });

  it("lets a route file import from inside a feature", () => {
    expect(at("app/groceries/page.tsx", "@/features/groceries/screens/list")).toEqual([]);
  });

  it("keeps other app files out of every feature", () => {
    expect(at("app/groceries/client.tsx", "@/features/groceries")).toEqual([shared]);
    expect(at("app/groceries/client.tsx", "@/features/groceries/screens/list")).toEqual([shared]);
  });

  it("keeps a feature out of another, by alias or relative path", () => {
    expect(at("features/groceries/list.tsx", "@/features/recipes")).toEqual([sibling]);
    expect(at("features/groceries/list.tsx", "@/features/recipes/panels/detail")).toEqual([
      sibling,
    ]);
    expect(at("features/groceries/list.tsx", "../recipes")).toHaveLength(1);
    expect(at("features/groceries/list.tsx", "../recipes/panels/detail")).toHaveLength(1);
  });

  it("lets a feature import inside itself", () => {
    expect(at("features/groceries/list.tsx", "./row")).toEqual([]);
    expect(at("features/groceries/list.tsx", "@/features/groceries")).toEqual([]);
    expect(at("features/groceries/list.tsx", "@/features/groceries/row")).toEqual([]);
  });
});
