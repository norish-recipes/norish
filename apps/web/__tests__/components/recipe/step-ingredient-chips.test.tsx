import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { StepIngredientDraft } from "@/components/recipes/step-ingredient-chips";
import { StepIngredientChips } from "@/components/recipes/step-ingredient-chips";

/**
 * The pickers are stubbed down to their contract — the rows they offer and
 * the action a row fires — because what matters is which references the row
 * produces, not how HeroUI renders a popover.
 */
vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    Dropdown: Object.assign(Passthrough, {
      Popover: Passthrough,
      Menu: ({ children }: { children?: React.ReactNode }) => <div role="menu">{children}</div>,
      Item: ({
        children,
        onAction,
        textValue,
      }: {
        children?: React.ReactNode;
        onAction?: () => void;
        textValue?: string;
      }) => (
        <button aria-label={textValue} role="menuitem" type="button" onClick={() => onAction?.()}>
          {children}
        </button>
      ),
    }),
    Button: ({
      children,
      onPress,
      "aria-label": ariaLabel,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      "aria-label"?: string;
    }) => (
      <button aria-label={ariaLabel} type="button" onClick={() => onPress?.()}>
        {children}
      </button>
    ),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Label: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { name?: string }) =>
    values?.name ? `${key}:${values.name}` : key,
}));

const LINES = [
  { ingredientName: "water", order: 0, amount: 50, unit: "ml" },
  { ingredientName: "# For the sauce", order: 1 },
  { ingredientName: "salt", order: 2 },
  { ingredientName: "eggs", order: 3, amount: 5, unit: null },
];

let onChange: ReturnType<typeof vi.fn>;
let onEntryKeyboardClose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onChange = vi.fn();
  onEntryKeyboardClose = vi.fn();
});

function renderChips(refs: StepIngredientDraft[], autoEntryOrder: number | null = null) {
  return render(
    <StepIngredientChips
      autoEntryOrder={autoEntryOrder}
      ingredients={LINES}
      refs={refs}
      onChange={onChange}
      onEntryKeyboardClose={onEntryKeyboardClose}
    />
  );
}

describe("StepIngredientChips", () => {
  it("attaches a line from the picker at the full share", () => {
    renderChips([]);

    fireEvent.click(screen.getByRole("menuitem", { name: "salt" }));

    expect(onChange).toHaveBeenCalledWith([{ ingredientOrder: 2, share: 1 }]);
  });

  it("never offers heading rows", () => {
    renderChips([]);

    expect(screen.queryByRole("menuitem", { name: /For the sauce/ })).not.toBeInTheDocument();
  });

  it("does not offer a line that is already attached", () => {
    renderChips([{ ingredientOrder: 2, share: 1 }]);

    expect(screen.queryByRole("menuitem", { name: "salt" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "water" })).toBeInTheDocument();
  });

  it("removes a chip with a tap", () => {
    renderChips([
      { ingredientOrder: 0, share: 1 },
      { ingredientOrder: 2, share: 1 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "removeLabel:water" }));

    expect(onChange).toHaveBeenCalledWith([{ ingredientOrder: 2, share: 1 }]);
  });

  it("sets a preset share of one half", () => {
    renderChips([{ ingredientOrder: 0, share: 1 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.half" }));

    expect(onChange).toHaveBeenCalledWith([{ ingredientOrder: 0, share: 0.5 }]);
  });

  it("shows the fractional share on a chip whose line has no amount", () => {
    renderChips([{ ingredientOrder: 2, share: 0.5 }]);

    expect(screen.getByText("½ × salt")).toBeInTheDocument();
  });

  it("labels partial use of an amounted line with the derived amount", () => {
    renderChips([{ ingredientOrder: 0, share: 0.5 }]);

    expect(screen.getByText("25 ml water")).toBeInTheDocument();
  });

  it("keeps the bare name on a full-share chip even when the line has an amount", () => {
    renderChips([{ ingredientOrder: 0, share: 1 }]);

    expect(screen.getByText("water")).toBeInTheDocument();
    expect(screen.queryByText("50 ml water")).not.toBeInTheDocument();
  });

  it("accepts a custom share typed by hand on an amountless line", () => {
    renderChips([{ ingredientOrder: 2, share: 1 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.custom" }));

    const input = screen.getByLabelText("customShareLabel");

    fireEvent.change(input, { target: { value: "0.4" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([{ ingredientOrder: 2, share: 0.4 }]);
  });

  it("stores an entered amount as the equivalent share of the line", () => {
    renderChips([{ ingredientOrder: 3, share: 1 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.amount" }));

    const input = screen.getByLabelText("customAmountLabel");

    // 3 of the 5 eggs: the cook types the amount, the chip stores the share.
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([{ ingredientOrder: 3, share: 0.6 }]);
  });

  it("prefills the amount input with the chip's current derived amount", () => {
    renderChips([{ ingredientOrder: 0, share: 0.5 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.amount" }));

    expect(screen.getByLabelText<HTMLInputElement>("customAmountLabel").value).toBe("25");
  });

  it("changes nothing when the input closes unedited", () => {
    // A third of 50 ml prefills as the rounded 16.67; leaving without typing
    // must not rewrite the stored third as 0.3334.
    renderChips([{ ingredientOrder: 0, share: 1 / 3 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.amount" }));
    fireEvent.blur(screen.getByLabelText("customAmountLabel"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers amount entry only where the line has an amount", () => {
    renderChips([{ ingredientOrder: 3, share: 1 }]);

    expect(screen.getByRole("menuitem", { name: "share.amount" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "share.custom" })).not.toBeInTheDocument();
  });

  it("keeps share entry where the line has none", () => {
    renderChips([{ ingredientOrder: 2, share: 1 }]);

    expect(screen.getByRole("menuitem", { name: "share.custom" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "share.amount" })).not.toBeInTheDocument();
  });

  it("ignores a custom share that is not a positive number", () => {
    renderChips([{ ingredientOrder: 2, share: 1 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.custom" }));

    const input = screen.getByLabelText("customShareLabel");

    fireEvent.change(input, { target: { value: "-2" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores an amount that is not a positive number", () => {
    renderChips([{ ingredientOrder: 3, share: 1 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.amount" }));

    const input = screen.getByLabelText("customAmountLabel");

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("asks for the amount after a picker attach of an amounted line", () => {
    const { rerender } = renderChips([]);

    fireEvent.click(screen.getByRole("menuitem", { name: "water" }));
    expect(onChange).toHaveBeenCalledWith([{ ingredientOrder: 0, share: 1 }]);

    // The parent applies the change; the chip appears and the ask opens,
    // prefilled with the whole line so typing replaces it.
    rerender(
      <StepIngredientChips
        autoEntryOrder={null}
        ingredients={LINES}
        refs={[{ ingredientOrder: 0, share: 1 }]}
        onChange={onChange}
        onEntryKeyboardClose={onEntryKeyboardClose}
      />
    );

    expect(screen.getByLabelText<HTMLInputElement>("customAmountLabel").value).toBe("50");
  });

  it("attaches an amountless line silently, asking nothing", () => {
    const { rerender } = renderChips([]);

    fireEvent.click(screen.getByRole("menuitem", { name: "salt" }));

    rerender(
      <StepIngredientChips
        autoEntryOrder={null}
        ingredients={LINES}
        refs={[{ ingredientOrder: 2, share: 1 }]}
        onChange={onChange}
        onEntryKeyboardClose={onEntryKeyboardClose}
      />
    );

    expect(screen.queryByLabelText("customAmountLabel")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("customShareLabel")).not.toBeInTheDocument();
  });

  it("opens the ask for a mention via autoEntryOrder and reports it handled", () => {
    const onAutoEntryHandled = vi.fn();

    render(
      <StepIngredientChips
        autoEntryOrder={3}
        ingredients={LINES}
        refs={[{ ingredientOrder: 3, share: 1 }]}
        onChange={onChange}
        onAutoEntryHandled={onAutoEntryHandled}
        onEntryKeyboardClose={onEntryKeyboardClose}
      />
    );

    expect(screen.getByLabelText<HTMLInputElement>("customAmountLabel").value).toBe("5");
    expect(onAutoEntryHandled).toHaveBeenCalled();
  });

  it("keeps the whole line when the ask is dismissed with Escape, and hands focus back", () => {
    renderChips([{ ingredientOrder: 0, share: 1 }], 0);

    fireEvent.keyDown(screen.getByLabelText("customAmountLabel"), { key: "Escape" });

    expect(onChange).not.toHaveBeenCalled();
    expect(onEntryKeyboardClose).toHaveBeenCalled();
  });

  it("commits a typed answer to the ask and hands focus back", () => {
    renderChips([{ ingredientOrder: 3, share: 1 }], 3);

    const input = screen.getByLabelText("customAmountLabel");

    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([{ ingredientOrder: 3, share: 0.6 }]);
    expect(onEntryKeyboardClose).toHaveBeenCalled();
  });

  it("does not yank focus when the ask closes by blur", () => {
    renderChips([{ ingredientOrder: 0, share: 1 }], 0);

    fireEvent.blur(screen.getByLabelText("customAmountLabel"));

    expect(onEntryKeyboardClose).not.toHaveBeenCalled();
  });

  it("never hands focus around for an entry opened from the chip's own menu", () => {
    renderChips([{ ingredientOrder: 3, share: 1 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.amount" }));

    const input = screen.getByLabelText("customAmountLabel");

    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalled();
    expect(onEntryKeyboardClose).not.toHaveBeenCalled();
  });

  it("renders nothing for a chip whose line no longer exists", () => {
    renderChips([{ ingredientOrder: 9, share: 1 }]);

    expect(screen.queryByRole("button", { name: /removeLabel/ })).not.toBeInTheDocument();
  });
});
