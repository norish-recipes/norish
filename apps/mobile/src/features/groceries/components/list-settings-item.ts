import type { HeaderItem, MenuItem } from "@/lib/header-item";
import type { IntlShape } from "react-intl";

import type { GroceryViewMode } from "@norish/shared/contracts/zod/device-preferences";

/** The gear as a native bar menu: view mode, grouping, Manage stores and Clear list. */
export function listSettingsItem(
  intl: IntlShape,
  {
    view,
    grouped,
    canClear,
    onManageStores,
    onView,
    onGrouped,
    onClear,
  }: {
    view: GroceryViewMode;
    grouped: boolean;
    canClear: boolean;
    onManageStores: () => void;
    onView: (view: GroceryViewMode) => void;
    onGrouped: (grouped: boolean) => void;
    onClear: () => void;
  }
): HeaderItem {
  const text = (id: string) => intl.formatMessage({ id });
  const label = text("groceries.mobile.listSettings");

  // The bar menu has no separator: an inline submenu is its section, and its label is required.
  const clearSection: MenuItem = {
    type: "submenu",
    inline: true,
    label: "",
    items: [
      {
        type: "action",
        label: text("groceries.page.clearList"),
        icon: { type: "sfSymbol", name: "trash" },
        destructive: true,
        onPress: onClear,
      },
    ],
  };
  const grouping: MenuItem[] =
    view === "store"
      ? [
          {
            type: "action",
            label: text("groceries.page.groupIngredients"),
            state: grouped ? "on" : "off",
            onPress: () => onGrouped(!grouped),
          },
        ]
      : [];

  return {
    type: "menu",
    label,
    accessibilityLabel: label,
    identifier: "groceries-settings",
    icon: { type: "sfSymbol", name: "gearshape" },
    menu: {
      items: [
        {
          type: "submenu",
          inline: true,
          label: text("groceries.mobile.viewMode"),
          items: [
            {
              type: "action",
              label: text("groceries.mobile.viewByStore"),
              state: view === "store" ? "on" : "off",
              onPress: () => onView("store"),
            },
            {
              type: "action",
              label: text("groceries.mobile.viewByRecipe"),
              state: view === "recipe" ? "on" : "off",
              onPress: () => onView("recipe"),
            },
          ],
        },
        ...grouping,
        {
          type: "action",
          label: text("groceries.mobile.manageStores"),
          icon: { type: "sfSymbol", name: "gearshape" },
          onPress: onManageStores,
        },
        ...(canClear ? [clearSection] : []),
      ],
    },
  };
}
