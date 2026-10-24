// @vitest-environment node

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(webRoot, "package.json"));
const reactDist = path.dirname(require.resolve("@heroui/react"));
const stylesDist = path.join(path.dirname(require.resolve("@heroui/styles/package.json")), "dist");

/** `export { A, B } from './x.js'` lines of a dist entry, as [name, path] pairs. */
function reExports(file: string): Array<[string, string]> {
  return [...fs.readFileSync(file, "utf8").matchAll(/export \{([^}]*)\} from '([^']+)'/g)].flatMap(
    ([, names = "", from = ""]) =>
      names
        .split(",")
        .map((name): [string, string] => [name.trim(), path.resolve(path.dirname(file), from)])
  );
}

/** Every style variant a HeroUI file uses, following its relative imports. */
function variantsUsedBy(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file) || !fs.existsSync(file)) return [];
  seen.add(file);
  const source = fs.readFileSync(file, "utf8");
  const own = [...source.matchAll(/import \{([^}]*)\} from '@heroui\/styles'/g)].flatMap(
    ([, names = ""]) => names.split(",").map((name) => name.trim())
  );
  const relative = [...source.matchAll(/from '(\.[^']+)'/g)].map(([, from = ""]) =>
    path.resolve(path.dirname(file), from)
  );

  return [...own, ...relative.flatMap((next) => variantsUsedBy(next, seen))];
}

describe("styles/heroui.css", () => {
  it("imports the styles of every HeroUI component the app draws, and what those draw", () => {
    const appImports = ["app", "components", "hooks", "context", "lib"]
      .flatMap((dir) =>
        fs
          .readdirSync(path.join(webRoot, dir), { recursive: true, encoding: "utf8" })
          .filter((file) => /\.tsx?$/.test(file))
          .map((file) => fs.readFileSync(path.join(webRoot, dir, file), "utf8"))
      )
      .flatMap((source) => [...source.matchAll(/import \{([^}]*)\} from "@heroui\/react"/g)])
      .flatMap(([, names = ""]) =>
        names.split(",").map((name) => name.replace(/^type /, "").trim())
      );
    const reactFiles = new Map(reExports(path.join(reactDist, "index.js")));
    // A variant's stylesheet is its component directory's: `listboxItemVariants` → list-box-item.
    const variantSheet = new Map(
      reExports(path.join(stylesDist, "index.js")).map(([name, file]) => [
        name,
        path.basename(path.dirname(file)),
      ])
    );
    const needed = new Set(
      appImports
        .flatMap((name) => {
          const file = reactFiles.get(name);

          return file ? variantsUsedBy(file) : [];
        })
        .map((variant) => variantSheet.get(variant))
    );
    const imported = fs.readFileSync(path.join(webRoot, "styles/heroui.css"), "utf8");

    // A broken walk must not read as a green run.
    expect(needed.size).toBeGreaterThan(20);
    expect(
      [...needed].filter((sheet) => !imported.includes(`@heroui/styles/components/${sheet}.css`))
    ).toEqual([]);
  });
});
