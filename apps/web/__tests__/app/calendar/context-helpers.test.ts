import { getInitialDateRange } from "@/app/(app)/calendar/context-helpers";
import { describe, expect, it } from "vitest";

import { dateKey } from "@norish/shared/lib/helpers";

const keys = (range: { start: Date; end: Date }) => [dateKey(range.start), dateKey(range.end)];

describe("getInitialDateRange", () => {
  it("opens the calendar on the weeks around the given day, Monday to Sunday", () => {
    // Friday 16 October 2026.
    expect(keys(getInitialDateRange("mobile", "2026-10-16"))).toEqual(["2026-09-28", "2026-11-01"]);
    expect(keys(getInitialDateRange("desktop", "2026-10-16"))).toEqual([
      "2026-10-12",
      "2026-10-18",
    ]);
  });

  it("puts a Sunday in the week that started the Monday before", () => {
    expect(keys(getInitialDateRange("desktop", "2026-10-18"))).toEqual([
      "2026-10-12",
      "2026-10-18",
    ]);
  });
});
