import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { Step } from "@/components/recipes/step-input";
import StepInput from "@/components/recipes/step-input";

vi.mock("motion/react", () => ({
  Reorder: {
    Group: ({ children }: { children?: React.ReactNode }) => <ul>{children}</ul>,
    Item: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  },
  useDragControls: () => ({ start: vi.fn() }),
}));

vi.mock("@/hooks/recipes", () => ({
  useRecipeImages: () => ({
    uploadStepImage: vi.fn(),
    deleteStepImage: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/components/shared/smart-text-input", () => ({
  // The mock keeps the real contract's two halves that matter here: the ref
  // reaches the textarea, and a mention hands (suggestion, newValue) up and
  // returns whether the caller took focus.
  default: ({
    value,
    onValueChange,
    onIngredientMention,
    ingredientSuggestions = [],
    ref,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    onIngredientMention?: (
      suggestion: { key: string; label: string; ingredientOrder: number },
      newValue: string
    ) => boolean | void;
    ingredientSuggestions?: { key: string; label: string; ingredientOrder: number }[];
    ref?: React.Ref<HTMLTextAreaElement>;
  }) => (
    <div>
      <textarea ref={ref} value={value} onChange={(event) => onValueChange(event.target.value)} />
      {ingredientSuggestions.map((suggestion) => (
        <button
          key={suggestion.key}
          type="button"
          onClick={() => onIngredientMention?.(suggestion, `${value} ${suggestion.label}`.trim())}
        >
          mention:{suggestion.label}
        </button>
      ))}
    </div>
  ),
}));

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

const INGREDIENTS = [
  { ingredientName: "salt", amount: 5, unit: "g", systemUsed: "metric" as const, order: 0 },
  { ingredientName: "pepper", amount: 3, unit: "g", systemUsed: "metric" as const, order: 1 },
  { ingredientName: "paprika", amount: 2, unit: "g", systemUsed: "metric" as const, order: 2 },
  { ingredientName: "parsley", amount: null, unit: null, systemUsed: "metric" as const, order: 3 },
  { ingredientName: "salt", amount: 1, unit: "tsp", systemUsed: "us" as const, order: 0 },
];

let onChange: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onChange = vi.fn();
});

function lastEmitted(): Step[] {
  return onChange.mock.calls.at(-1)?.[0] as Step[];
}

describe("StepInput chips", () => {
  it("emits attached chips riding the step payload, with reference orders reindexed", () => {
    render(
      <StepInput
        ingredients={INGREDIENTS}
        steps={[
          {
            step: "Add the spices.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
          },
        ]}
        systemUsed="metric"
        onChange={onChange}
      />
    );

    // The aggregate case: "add the spices" picks up its second line.
    fireEvent.click(screen.getByRole("menuitem", { name: "pepper" }));

    expect(lastEmitted()[0]?.stepIngredients).toEqual([
      { ingredientOrder: 0, share: 1, order: 0 },
      { ingredientOrder: 1, share: 1, order: 1 },
    ]);
  });

  it("offers no chips row on a heading row, and sheds chips a row had before it became one", () => {
    render(
      <StepInput
        ingredients={INGREDIENTS}
        steps={[
          {
            step: "Add the salt.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
          },
        ]}
        systemUsed="metric"
        onChange={onChange}
      />
    );

    const textarea = screen.getAllByRole("textbox")[0]!;

    fireEvent.change(textarea, { target: { value: "# For the sauce" } });

    // The row became a heading: no chips row is offered for it, and the emit
    // carries no references for a row a reader will never see links on.
    expect(lastEmitted()[0]?.stepIngredients).toEqual([]);
    expect(screen.queryByRole("menuitem", { name: "pepper" })).not.toBeInTheDocument();
  });

  it("keeps chip edits flowing through onChange when a share changes", () => {
    render(
      <StepInput
        ingredients={INGREDIENTS}
        steps={[
          {
            step: "Add half the salt.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
          },
        ]}
        systemUsed="metric"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "share.half" }));

    expect(lastEmitted()[0]?.stepIngredients).toEqual([
      { ingredientOrder: 0, share: 0.5, order: 0 },
    ]);
  });

  it("asks for the amount after a picker attach, and commits the answer as a share", () => {
    render(
      <StepInput
        ingredients={INGREDIENTS}
        steps={[
          {
            step: "Season it.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [],
          },
        ]}
        systemUsed="metric"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "pepper" }));

    // The chip attached at the whole line and the ask opened over it,
    // prefilled with the line's amount.
    const input = screen.getByLabelText<HTMLInputElement>("customAmountLabel");

    expect(input.value).toBe("3");

    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(lastEmitted()[0]?.stepIngredients).toEqual([
      { ingredientOrder: 1, share: 0.5, order: 0 },
    ]);
    // Keyboard close hands focus back to the step's text.
    expect(document.activeElement).toBe(screen.getAllByRole("textbox")[0]);
  });

  it("the mention gesture attaches, asks, and an Escape keeps the whole line", () => {
    render(
      <StepInput
        ingredients={INGREDIENTS}
        steps={[
          {
            step: "Season it.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [],
          },
        ]}
        systemUsed="metric"
        onChange={onChange}
      />
    );

    // One mention button per row — the trailing empty row has its own.
    fireEvent.click(screen.getAllByRole("button", { name: "mention:salt" })[0]!);

    expect(lastEmitted()[0]?.stepIngredients).toEqual([{ ingredientOrder: 0, share: 1, order: 0 }]);

    const input = screen.getByLabelText<HTMLInputElement>("customAmountLabel");

    expect(input.value).toBe("5");

    fireEvent.keyDown(input, { key: "Escape" });

    // Dismissed: the chip stays at the whole line, focus back in the text.
    expect(lastEmitted()[0]?.stepIngredients).toEqual([{ ingredientOrder: 0, share: 1, order: 0 }]);
    expect(document.activeElement).toBe(screen.getAllByRole("textbox")[0]);
  });

  it("keeps the whole line when the ask is escaped after typing", () => {
    render(
      <StepInput
        ingredients={INGREDIENTS}
        steps={[
          {
            step: "Season it.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [],
          },
        ]}
        systemUsed="metric"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "pepper" }));

    const input = screen.getByLabelText<HTMLInputElement>("customAmountLabel");

    // Typed, then thought better of it. The Escape hands focus back to the
    // step's text, and that focus shift blurs the input — which must not
    // commit the abandoned value on re-entry.
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(lastEmitted()[0]?.stepIngredients).toEqual([{ ingredientOrder: 1, share: 1, order: 0 }]);
  });

  it("attaches an amountless line silently, with nothing to ask", () => {
    render(
      <StepInput
        ingredients={INGREDIENTS}
        steps={[
          {
            step: "Season it.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [],
          },
        ]}
        systemUsed="metric"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "mention:parsley" })[0]!);

    expect(lastEmitted()[0]?.stepIngredients).toEqual([{ ingredientOrder: 3, share: 1, order: 0 }]);
    expect(screen.queryByLabelText("customAmountLabel")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("customShareLabel")).not.toBeInTheDocument();
  });

  it("derives chip amounts from the active system's lines", () => {
    render(
      <StepInput
        ingredients={INGREDIENTS}
        steps={[
          {
            step: "Add half the salt.",
            order: 0,
            systemUsed: "metric",
            stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
          },
        ]}
        systemUsed="metric"
        onChange={onChange}
      />
    );

    // The salt line exists in both systems at order 0; the chip resolves
    // against the metric one because that is the system being edited.
    expect(screen.getByText("2.5 g salt")).toBeInTheDocument();
  });
});
