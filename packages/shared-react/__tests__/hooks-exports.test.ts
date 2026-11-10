import { describe, expect, it } from "vitest";

import { createUnitFormatter } from "@norish/shared-react/hooks";
import { useServingsScaler } from "@norish/shared-react/recipes";

describe("hooks exports", () => {
  it("exports moved shared hooks", () => {
    expect(typeof createUnitFormatter).toBe("function");
    expect(typeof useServingsScaler).toBe("function");
  });
});
