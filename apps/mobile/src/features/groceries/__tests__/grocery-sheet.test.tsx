// @vitest-environment jsdom
import type { ReactNode } from "react";
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";

type Header = {
  confirm?: { label: string; onPress?: () => void };
  secondary?: { label: string; onPress: () => void }[];
};

vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/modal-header", () => ({
  destructiveAction: (label: string, onPress: () => void) => ({ label, onPress }),
}));
vi.mock("@/components/sheet", () => ({
  // A sheet's header items are pressed by their own ids.
  Sheet: ({
    name,
    confirm,
    secondary = [],
    children,
  }: Header & { name: string; children?: ReactNode }) =>
    createElement(
      "div",
      { "data-testid": `${name}-sheet` },
      children,
      ...secondary.map((action) =>
        createElement("button", {
          key: action.label,
          "data-testid": action.label,
          onClick: action.onPress,
        })
      ),
      createElement("button", {
        "data-testid": confirm?.label,
        onClick: confirm?.onPress,
      })
    ),
  SheetBody: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@/hooks/use-resolved-color-scheme", () => ({ useResolvedColorScheme: () => "light" }));
vi.mock("../hooks/use-after-keyboard", () => ({
  useAfterKeyboard: () => (run: () => void) => run(),
}));
vi.mock("../hooks/use-recurrence-label", () => ({ useRecurrenceLabel: () => () => "weekly" }));
vi.mock("../hooks/use-store-color", () => ({ storeColorIn: () => "red" }));
vi.mock("../components/choice-list", () => ({ ChoiceList: () => null }));
vi.mock("../components/repeat-view", () => ({ RepeatBody: () => null }));
vi.mock("../components/form-parts", () => ({
  FormCard: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  FormRow: ({ testID, onPress }: { testID: string; onPress: () => void }) =>
    createElement("button", { "data-testid": testID, onClick: onPress }),
  RepeatPills: () => null,
}));

const { GrocerySheet } = await import("../components/grocery-sheet");

const weekly = { rule: "weekly", interval: 1 } as unknown as RecurrencePattern;

describe("GrocerySheet repeat step", () => {
  it("clears the repeat and goes back to the form from its Remove item", () => {
    const onRepeat = vi.fn();

    render(
      <GrocerySheet
        actions={{ confirm: { label: "Save", onPress: vi.fn() } }}
        aisleId={null}
        aisles={[]}
        detected={null}
        field={null}
        name="edit-grocery"
        noStoreLabelId="x"
        repeat={weekly}
        storeId={null}
        stores={[]}
        title="Edit"
        onAisle={vi.fn()}
        onConfirmDetected={vi.fn()}
        onRepeat={onRepeat}
        onStore={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("edit-grocery-repeat"));
    fireEvent.click(screen.getByTestId("common.actions.remove"));

    expect(onRepeat).toHaveBeenCalledExactlyOnceWith(null);
    expect(screen.getByTestId("edit-grocery-sheet")).toBeTruthy();
    expect(screen.getByTestId("Save")).toBeTruthy();
  });

  it("has no Remove item while no repeat is set", () => {
    render(
      <GrocerySheet
        actions={{ confirm: { label: "Save", onPress: vi.fn() } }}
        aisleId={null}
        aisles={[]}
        detected={null}
        field={null}
        name="edit-grocery"
        noStoreLabelId="x"
        repeat={null}
        storeId={null}
        stores={[]}
        title="Edit"
        onAisle={vi.fn()}
        onConfirmDetected={vi.fn()}
        onRepeat={vi.fn()}
        onStore={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("edit-grocery-repeat"));

    expect(screen.queryByTestId("common.actions.remove")).toBeNull();
  });
});
