// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("PublicSmartInstruction boundary", () => {
  it("does not import authenticated hooks or private recipe context", () => {
    const file = readFileSync(
      path.resolve(process.cwd(), "components/recipe/public-smart-instruction.tsx"),
      "utf8"
    );

    expect(file).not.toContain("@/hooks/config");
    expect(file).not.toContain("@/context/user-context");
    expect(file).not.toContain("useRecipeContext");
  });
});
