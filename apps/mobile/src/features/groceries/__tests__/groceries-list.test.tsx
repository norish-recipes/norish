// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroceryDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

import type { ListActions } from "../components/groceries-list";
import type { ListRow } from "../utils/list-rows";

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const tag =
    (name: string) =>
    ({
      children,
      testID,
      onPress,
    }: {
      children?: React.ReactNode;
      testID?: string;
      onPress?: () => void;
    }) =>
      createElement(name, { "data-testid": testID, onClick: onPress }, children);

  return { View: tag("div"), Text: tag("span"), Pressable: tag("button") };
});
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("heroui-native", () => ({ useThemeColor: () => ["grey"] }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/components/amount-name", () => ({
  AmountName: ({ name }: { name: string }) => name,
  amountNameLabel: (amount: string, name: string) => `${amount} ${name}`,
}));
vi.mock("@/components/tab-list-inset", () => ({ tabListBottomInset: () => 0 }));
vi.mock("@norish/shared-react/recipes", () => ({
  useUnitFormatter: () => ({ formatAmountUnit: (amount: number | null) => String(amount) }),
}));
vi.mock("@norish/shared-react/groceries", () => ({ lineOf: vi.fn(), lineOfGroup: vi.fn() }));
vi.mock("../hooks/use-recurrence-label", () => ({ useRecurrenceLabel: () => () => "" }));
vi.mock("../hooks/use-store-color", () => ({ useStoreColor: () => undefined }));
vi.mock("../components/store-heading-row", () => ({ StoreHeadingRow: () => null }));
vi.mock("../components/recipe-heading-row", () => ({ RecipeHeadingRow: () => null }));
vi.mock("../components/aisle-heading-row", () => ({ AisleHeadingRow: () => null }));
vi.mock("../components/done-row", () => ({ DoneRow: () => null }));
vi.mock("../components/grocery-row", () => ({ GroceryRow: () => null }));
vi.mock("../components/grocery-price", () => ({ GroceryPrice: () => null }));
vi.mock("../components/store-tick", () => ({ StoreTick: () => null }));
// The library remounts the cells a reorder passed (a new key each time), as this does on render.
vi.mock("@/components/drag-list/drag-list", async () => {
  const { createElement, Fragment } = await import("react");
  let generation = 0;

  return {
    useIsLifted: () => false,
    DragList: ({
      rows,
      renderItem,
    }: {
      rows: ListRow[];
      renderItem: (item: unknown, drag: () => void) => React.ReactNode;
    }) => {
      generation += 1;

      return rows.map((row) =>
        createElement(
          Fragment,
          { key: `${row.key}#${generation}` },
          row.kind === "item" ? renderItem(row.value, () => {}) : null
        )
      );
    },
  };
});

const { GroceriesList } = await import("../components/groceries-list");

const grocery = (id: string) =>
  ({ id, name: "milk", amount: 1, unit: "l", isDone: false }) as unknown as GroceryDto;
const group = {
  groupKey: "milk",
  primaryId: "a",
  displayName: "milk",
  totalAmount: 2,
  displayUnit: "l",
  allDone: false,
  anyDone: false,
  sources: [
    { grocery: grocery("a"), recipeName: null },
    { grocery: grocery("b"), recipeName: null },
  ],
} as unknown as GroceryGroup;
const rows: ListRow[] = [
  {
    kind: "item",
    key: "group:milk",
    value: {
      type: "group",
      group,
      store: null,
      key: "milk",
      done: false,
      edge: { top: true, bottom: true },
    },
  },
];
/** The list under a parent that holds its fold state, as the screen does. */
function Screen() {
  const [openGroups, setOpenGroups] = React.useState<ReadonlySet<string>>(new Set());
  const actions = new Proxy(
    { toggleGroup: (key: string) => setOpenGroups(new Set([...openGroups, key])) },
    { get: (target, name) => (name === "toggleGroup" ? target.toggleGroup : vi.fn()) }
  ) as unknown as ListActions;

  return (
    <GroceriesList
      actions={actions}
      empty={null}
      header={<></>}
      openGroups={openGroups}
      recipeNameFor={() => null}
      recurringById={new Map()}
      rows={rows}
      storeNameOnLines={false}
      onDrop={() => true}
    />
  );
}

describe("GroceriesList", () => {
  it("keeps a group folded out when a drop remounts its row", () => {
    const { rerender } = render(<Screen />);

    fireEvent.click(screen.getByTestId("group-a"));
    expect(screen.queryByTestId("group-sources-a")).not.toBeNull();

    rerender(<Screen />);
    expect(screen.queryByTestId("group-sources-a")).not.toBeNull();
  });
});
