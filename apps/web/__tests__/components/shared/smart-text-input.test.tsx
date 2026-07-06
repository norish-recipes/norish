import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SmartTextInput from "@/components/shared/smart-text-input";

vi.mock("@/hooks/recipes", () => ({
  useRecipeAutocomplete: () => ({ suggestions: [], isLoading: false }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function SmartTextInputHarness() {
  const [value, setValue] = useState("");

  return (
    <>
      <SmartTextInput
        ingredientSuggestions={[
          {
            key: "metric:ground black pepper",
            label: "Ground black pepper",
            token: "@ground black pepper{2 g}",
          },
        ]}
        placeholder="Step"
        value={value}
        onValueChange={setValue}
      />
      <output>{value}</output>
    </>
  );
}

describe("SmartTextInput ingredient autocomplete", () => {
  it("shows ingredient suggestions for at-sign triggers", () => {
    render(<SmartTextInputHarness />);

    fireEvent.change(screen.getByPlaceholderText("Step"), {
      target: { value: "Add @gro" },
    });

    expect(screen.getByText("Ground black pepper")).toBeInTheDocument();
  });

  it("inserts ingredient link markup when a suggestion is selected", () => {
    render(<SmartTextInputHarness />);

    fireEvent.change(screen.getByPlaceholderText("Step"), {
      target: { value: "Add @gro" },
    });
    fireEvent.click(screen.getByText("Ground black pepper"));

    expect(screen.getByPlaceholderText("Step")).toHaveValue("Add @ground black pepper{2 g}");
  });

  it("uses the nearest trigger when slash autocomplete appears earlier in the step", () => {
    render(<SmartTextInputHarness />);

    fireEvent.change(screen.getByPlaceholderText("Step"), {
      target: { value: "See /sauce and add @gro" },
    });

    expect(screen.getByText("Ground black pepper")).toBeInTheDocument();
  });
});
