import { describe, expect, it } from "vitest";

import { createUnitFormatter, useServingsScaler } from "@norish/shared-react/hooks";

describe("hooks exports", () => {
  it("exports moved shared hooks", () => {
    expect(typeof createUnitFormatter).toBe("function");
    expect(typeof useServingsScaler).toBe("function");
  });
});
