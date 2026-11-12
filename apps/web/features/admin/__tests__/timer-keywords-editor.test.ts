/**
 * The timer keywords are typed as one comma-separated list, and an Arabic
 * keyboard types its own comma: "ساعة، ساعات" is two keywords, not one.
 */
import { splitKeywords } from "@/features/admin/components/content-detection/timer-keywords-editor";
import { describe, expect, it } from "vitest";

describe("splitKeywords", () => {
  it("splits on a Latin comma", () => {
    expect(splitKeywords("hour, hours,hr")).toEqual(["hour", "hours", "hr"]);
  });

  it("splits on an Arabic comma, and on both mixed", () => {
    expect(splitKeywords("ساعة، ساعات، س")).toEqual(["ساعة", "ساعات", "س"]);
    expect(splitKeywords("ساعة, hour، stunde")).toEqual(["ساعة", "hour", "stunde"]);
  });

  it("drops empty entries", () => {
    expect(splitKeywords(" , ،hour,, ")).toEqual(["hour"]);
  });
});
