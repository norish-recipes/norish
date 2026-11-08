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
    "shared-react/src/offline/react",
    "shared-react/src/hooks",
    "shared-react/src/contexts"
  );
  const cwd = path.join(root, "shared-react");
  const config = restrictDomains(cwd, {
    srcDir: "src",
    crossCutting: ["trpc", "offline"],
    legacy: ["hooks", "contexts"],
  });
  const at = (file: string, from: string) => lint(cwd, config, `src/${file}`, from);

  it("stops a domain importing another, by path or package name", () => {
    expect(at("groceries/list.ts", "../recipes/detail")).toEqual([
      "A domain never imports another; share code through a cross-cutting folder.",
    ]);
    expect(at("groceries/list.ts", "@norish/shared-react/recipes")).toHaveLength(1);
  });

  it("lets a domain import itself and cross-cutting folders", () => {
    expect(at("groceries/list.ts", "./row")).toEqual([]);
    expect(at("groceries/list.ts", "../trpc")).toEqual([]);
    expect(at("groceries/list.ts", "@norish/shared-react/offline")).toEqual([]);
  });

  it("stops a cross-cutting folder importing a domain or a legacy folder", () => {
    expect(at("trpc/client.ts", "../groceries")).toEqual([
      "A cross-cutting folder imports only other cross-cutting folders.",
    ]);
    expect(at("offline/react/hook.ts", "../../recipes/detail")).toHaveLength(1);
    expect(at("offline/engine.ts", "../hooks/use-user")).toHaveLength(1);
    expect(at("offline/react/hook.ts", "@norish/shared-react/contexts")).toHaveLength(1);
  });

  it("lets a cross-cutting folder import another", () => {
    expect(at("offline/engine.ts", "../trpc")).toEqual([]);
  });

  it("leaves the legacy folders unrestricted", () => {
    expect(at("hooks/use-user.ts", "../groceries")).toEqual([]);
  });

  it("still blocks the legacy folders before any domain exists", () => {
    folders("bare/src/trpc", "bare/src/hooks");
    const bareRoot = path.join(root, "bare");
    const bare = restrictDomains(bareRoot, {
      srcDir: "src",
      crossCutting: ["trpc"],
      legacy: ["hooks"],
    });

    expect(lint(bareRoot, bare, "src/trpc/client.ts", "../hooks")).toHaveLength(1);
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

  it("stops shared code importing a feature", () => {
    expect(at("components/card.tsx", "@/features/groceries")).toEqual([
      "Shared code never imports a feature.",
    ]);
    expect(at("components/card.tsx", "../features/recipes/screens/detail")).toHaveLength(1);
  });

  it("lets a route file import from inside a feature", () => {
    expect(at("app/groceries/page.tsx", "@/features/groceries/screens/list")).toEqual([]);
  });

  it("holds other app files to a feature's index.ts", () => {
    expect(at("app/groceries/client.tsx", "@/features/groceries")).toEqual([]);
    expect(at("app/groceries/client.tsx", "@/features/groceries/screens/list")).toEqual([
      "Import a feature through its index.ts; only route files import from inside one.",
    ]);
  });

  it("holds a feature to another's index.ts, by alias or relative path", () => {
    expect(at("features/groceries/list.tsx", "@/features/recipes")).toEqual([]);
    expect(at("features/groceries/list.tsx", "@/features/recipes/panels/detail")).toEqual([
      "Import another feature through its index.ts.",
    ]);
    expect(at("features/groceries/list.tsx", "../recipes/panels/detail")).toHaveLength(1);
  });

  it("lets a feature import inside itself", () => {
    expect(at("features/groceries/list.tsx", "./row")).toEqual([]);
    expect(at("features/groceries/list.tsx", "@/features/groceries/row")).toEqual([]);
  });
});
