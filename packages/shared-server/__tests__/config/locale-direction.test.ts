// @vitest-environment node
/**
 * The page's `dir` comes from its locale: Arabic runs right to left, whatever
 * region its code carries.
 */
import { describe, expect, it } from "vitest";

import { getLocaleDirection } from "@norish/i18n/config";

describe("getLocaleDirection", () => {
  it("runs Arabic right to left, whatever its region", () => {
    expect(getLocaleDirection("ar")).toBe("rtl");
    expect(getLocaleDirection("ar-EG")).toBe("rtl");
  });

  it("runs every other bundled language left to right", () => {
    expect(getLocaleDirection("en")).toBe("ltr");
    expect(getLocaleDirection("de-formal")).toBe("ltr");
    expect(getLocaleDirection("uk")).toBe("ltr");
  });
});
