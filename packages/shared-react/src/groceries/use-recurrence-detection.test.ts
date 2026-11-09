import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRecurrenceDetection } from "@norish/shared-react/groceries";

const words = {
  everyWords: [],
  otherWords: [],
  onWords: [],
  numberWords: {},
  unitWords: { day: [], week: [], month: [], year: [] },
  weekdayWords: {},
  intervalHints: [
    { phrases: ["fortnightly"], interval: 2, rule: "week" },
    // An administrator's own rule, which the stored schema accepts as any string.
    { phrases: ["each lustrum"], interval: 5, rule: "lustrum" },
  ],
};

// One object, as the query cache hands back the same answer on every render.
const recurrenceConfig = { locales: { en: words }, isOverridden: true };

vi.mock("../config", () => ({ useRecurrenceConfigQuery: () => ({ recurrenceConfig }) }));

describe("useRecurrenceDetection", () => {
  it("reads a hint with one of the four rules and skips any other", async () => {
    const { result, rerender } = renderHook(
      ({ itemName }) => useRecurrenceDetection({ itemName }),
      { initialProps: { itemName: "milk fortnightly" } }
    );

    await waitFor(() =>
      expect(result.current.detectedPattern?.pattern).toEqual({ rule: "week", interval: 2 })
    );

    rerender({ itemName: "milk each lustrum" });

    await waitFor(() => expect(result.current.detectedPattern).toBeNull());
  });
});
