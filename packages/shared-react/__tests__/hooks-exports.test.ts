import { describe, expect, it } from "vitest";

import { useServingsScaler, useUnitFormatter } from "@norish/shared-react/hooks";

describe("hooks exports", () => {
  it("exports moved shared hooks", () => {
    expect(typeof useUnitFormatter).toBe("function");
    expect(typeof useServingsScaler).toBe("function");
  });
});
