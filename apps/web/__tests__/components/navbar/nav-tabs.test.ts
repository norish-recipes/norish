import { navTabPosition, slidesBack, useNavTabs } from "@/components/navbar/nav-tabs";
import { SETTINGS_HREF } from "@/components/settings/settings-tab";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ isBring: false }));

vi.mock("@norish/shared-react/config", () => ({
  useGroceryListProvider: () => ({
    provider: provider.isBring ? "bring" : "builtin",
    isBring: provider.isBring,
    isLoading: false,
  }),
}));

/** The tabs without Groceries, as Bring! mode shows them. */
const BRING_TABS = ["/", "/calendar", SETTINGS_HREF];

describe("navTabPosition", () => {
  it("counts the tabs from the left: Recipes, Groceries, Calendar, Settings", () => {
    expect(
      ["/", "/groceries", "/calendar", "/settings"].map((path) => navTabPosition(path))
    ).toEqual([0, 1, 2, 3]);
  });

  it("places a page under its tab, query or not", () => {
    expect(navTabPosition("/groceries/pantry")).toBe(1);
    expect(navTabPosition("/settings/household")).toBe(3);
    expect(navTabPosition("/settings/admin")).toBe(3);
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
    expect(slidesBack("/groceries", "/settings/account")).toBe(false);
    expect(slidesBack("/recipes/abc", "/")).toBe(false);
  });
});

describe("the tabs without Groceries", () => {
  it("count the remaining tabs from the left", () => {
    expect(["/", "/calendar", "/settings"].map((path) => navTabPosition(path, BRING_TABS))).toEqual(
      [0, 1, 2]
    );
  });

  it("find no tab for Groceries", () => {
    expect(navTabPosition("/groceries", BRING_TABS)).toBe(-1);
  });

  it("slide by the remaining order", () => {
    expect(slidesBack("/settings", "/calendar", BRING_TABS)).toBe(true);
    expect(slidesBack("/calendar", "/settings", BRING_TABS)).toBe(false);
  });
});

describe("useNavTabs", () => {
  it("lists Home, Groceries and Calendar, then Settings, while the list is built in", () => {
    provider.isBring = false;

    const { items, tabs } = renderHook(() => useNavTabs()).result.current;

    expect(items.map((item) => item.href)).toEqual(["/", "/groceries", "/calendar"]);
    expect(tabs).toEqual(["/", "/groceries", "/calendar", SETTINGS_HREF]);
  });

  it("drops Groceries, and only Groceries, when Bring! is the list", () => {
    provider.isBring = true;

    const { items, tabs } = renderHook(() => useNavTabs()).result.current;

    expect(items.map((item) => item.href)).toEqual(["/", "/calendar"]);
    expect(tabs).toEqual(BRING_TABS);
  });
});
