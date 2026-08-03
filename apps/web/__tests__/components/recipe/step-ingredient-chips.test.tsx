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
  { ingredientName: "water", order: 0 },
  { ingredientName: "# For the sauce", order: 1 },
  { ingredientName: "salt", order: 2 },
  { ingredientName: "paprika", order: 3 },
];

let onChange: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onChange = vi.fn();
});

function renderChips(refs: StepIngredientDraft[]) {
  return render(<StepIngredientChips ingredients={LINES} refs={refs} onChange={onChange} />);
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

  it("shows the fractional share on the chip", () => {
    renderChips([{ ingredientOrder: 0, share: 0.5 }]);

    expect(screen.getByText("½ × water")).toBeInTheDocument();
  });

  it("accepts a custom share typed by hand", () => {
    renderChips([{ ingredientOrder: 0, share: 1 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.custom" }));

    const input = screen.getByLabelText("customShareLabel");

    fireEvent.change(input, { target: { value: "0.4" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([{ ingredientOrder: 0, share: 0.4 }]);
  });

  it("ignores a custom share that is not a positive number", () => {
    renderChips([{ ingredientOrder: 0, share: 1 }]);

    fireEvent.click(screen.getByRole("menuitem", { name: "share.custom" }));

    const input = screen.getByLabelText("customShareLabel");

    fireEvent.change(input, { target: { value: "-2" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders nothing for a chip whose line no longer exists", () => {
    renderChips([{ ingredientOrder: 9, share: 1 }]);

    expect(screen.queryByRole("button", { name: /removeLabel/ })).not.toBeInTheDocument();
  });
});
