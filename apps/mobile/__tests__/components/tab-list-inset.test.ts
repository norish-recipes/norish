import { tabListBottomInset } from "@/components/tab-list-inset";
import { describe, expect, it } from "vitest";

describe("tab list bottom inset", () => {
  it("ends the list above the tab bar and its accessory", () => {
    expect(tabListBottomInset(34)).toBe(34 + 49 + 72);
  });
});
