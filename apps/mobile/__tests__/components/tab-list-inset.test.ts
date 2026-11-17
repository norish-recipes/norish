import { LOAD_MORE_FOOTER_HEIGHT, tabListBottomInset } from "@/components/tab-list-inset";
import { describe, expect, it } from "vitest";

describe("tab list bottom inset", () => {
  it("ends the list above the tab bar and its accessory", () => {
    expect(tabListBottomInset(34)).toBe(34 + 49 + 72);
  });

  it("leaves the load-more footer inside the content, so it sits above that inset", () => {
    expect(LOAD_MORE_FOOTER_HEIGHT).toBeGreaterThan(0);
    expect(LOAD_MORE_FOOTER_HEIGHT).toBeLessThanOrEqual(tabListBottomInset(0));
  });
});
