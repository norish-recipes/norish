import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { babel, releaseCode } from "./release-module";

const src = new URL("../src", import.meta.url).pathname;
const files = readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter(
    (file) => /\.tsx?$/.test(file) && readFileSync(join(src, file), "utf8").includes('"worklet"')
  )
  .sort();

/** What each worklet captures before it is assigned: the plugin builds a worklet by passing them to
 * a `…Factory` call, so a `var` declared later is `undefined` there and on the UI thread. */
function unassignedCaptures(file: string) {
  const ast = babel.parseSync(releaseCode(file), { sourceType: "script" });
  const found: string[] = [];

  if (!ast) return found;
  babel.traverse(ast, {
    CallExpression(path) {
      const { callee, arguments: [captured] = [] } = path.node;

      if (!callee?.id?.name?.endsWith("Factory") || captured?.type !== "ArrayExpression") return;
      const body = path.getFunctionParent()?.node;

      for (const element of captured.elements ?? []) {
        if (element?.type !== "Identifier" || !element.name) continue;
        const binding = path.scope.getBinding(element.name);

        // Only a binding of the body that builds the worklet can still be unassigned: an outer
        // one's body has run by then, and function declarations are hoisted.
        if (!binding || binding.kind === "hoisted" || binding.kind === "param") continue;
        if (binding.path.getFunctionParent()?.node !== body) continue;
        if (binding.path.node.end > path.node.start) found.push(element.name);
      }
    },
  });

  return found;
}

describe("worklet closures in a release build", () => {
  // Every transform runs here, on the hook's own limit: the first loads Expo's preset and the
  // compiler, and drag-list.tsx took 3.8 s under 24 parallel runs (0.3 s alone), so 60 s.
  const captures = new Map<string, string[]>();

  beforeAll(() => {
    for (const file of files) captures.set(file, unassignedCaptures(join(src, file)));
  }, 60_000);

  it("finds the modules with worklets", () => {
    expect(files).toContain("components/drag-list/drop-target.ts");
  });

  it.each(files)("%s captures nothing before it is assigned", (file) => {
    expect(captures.get(file)).toEqual([]);
  });
});
