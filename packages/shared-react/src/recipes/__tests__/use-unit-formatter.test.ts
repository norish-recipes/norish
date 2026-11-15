import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUnitFormatter } from "../use-unit-formatter";

vi.mock("../../config", () => ({
  useUnitsQuery: () => ({
    units: {
      tbsp: {
        short: [{ locale: "en", name: "tbsp" }],
        plural: [{ locale: "en", name: "tbsp" }],
        alternates: [],
      },
    },
  }),
}));
vi.mock("../../reader", () => ({ useDevicePreference: () => ["short"] }));

describe("useUnitFormatter", () => {
  it("writes an amount with its unit, and a bare amount as a count", () => {
    const { result } = renderHook(() => useUnitFormatter("en"));

    expect(result.current.formatAmountUnit(2, "tbsp")).toBe("2 tbsp");
    expect(result.current.formatAmountUnit(2, null)).toBe("2×");
    expect(result.current.formatAmountUnit(null, null)).toBe("");
  });
});
