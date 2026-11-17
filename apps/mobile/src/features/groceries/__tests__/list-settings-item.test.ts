import { describe, expect, it, vi } from "vitest";

import { listSettingsItem } from "../components/list-settings-item";

const intl = { formatMessage: ({ id }: { id: string }) => id } as never;
const base = {
  view: "store" as "store" | "recipe",
  grouped: true,
  canClear: true,
  onManageStores: vi.fn(),
  onView: vi.fn(),
  onGrouped: vi.fn(),
  onClear: vi.fn(),
};

function menuOf(overrides: Partial<typeof base>) {
  const item = listSettingsItem(intl, { ...base, ...overrides });

  if (item.type !== "menu") throw new Error("not a menu");

  return item.menu.items;
}

describe("listSettingsItem", () => {
  it("marks the view mode and offers grouping and Clear list by store", () => {
    const items = menuOf({});

    expect(items).toHaveLength(4);
    expect(items[1]).toMatchObject({ type: "action", state: "on" });
    expect(items[3]).toMatchObject({ type: "submenu" });
  });

  it("drops grouping by recipe and Clear list on an empty list", () => {
    expect(menuOf({ view: "recipe", canClear: false })).toHaveLength(2);
  });

  it("toggles grouping off from on", () => {
    const [, group] = menuOf({});

    if (group?.type !== "action") throw new Error("not an action");
    group.onPress();
    expect(base.onGrouped).toHaveBeenCalledWith(false);
  });
});
