import { navTabPosition, slidesBack } from "@/components/navbar/nav-tabs";
import { describe, expect, it } from "vitest";

describe("navTabPosition", () => {
  it("counts the tabs from the left: Recipes, Groceries, Calendar, Settings", () => {
    expect(["/", "/groceries", "/calendar", "/settings"].map(navTabPosition)).toEqual([0, 1, 2, 3]);
  });

  it("places a page under its tab, query or not", () => {
    expect(navTabPosition("/groceries/pantry")).toBe(1);
    expect(navTabPosition("/settings?tab=household")).toBe(3);
    expect(navTabPosition("/?q=stew")).toBe(0);
  });

  it("gives a page outside the tabs no position", () => {
    expect(navTabPosition("/recipes/abc")).toBe(-1);
    expect(navTabPosition("/cookbooks/abc")).toBe(-1);
    expect(navTabPosition("/groceriesx")).toBe(-1);
  });
});

describe("slidesBack", () => {
  it("slides a tab left of the current page in from the left", () => {
    expect(slidesBack("/calendar", "/groceries")).toBe(true);
    expect(slidesBack("/settings", "/")).toBe(true);
  });

  it("slides a tab to the right, or one opened from outside the tabs, forward", () => {
    expect(slidesBack("/", "/calendar")).toBe(false);
    expect(slidesBack("/groceries", "/settings?tab=user")).toBe(false);
    expect(slidesBack("/recipes/abc", "/")).toBe(false);
  });
});
