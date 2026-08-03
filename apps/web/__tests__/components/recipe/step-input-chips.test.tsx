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
  default: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (value: string) => void;
  }) => <textarea value={value} onChange={(event) => onValueChange(event.target.value)} />,
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
