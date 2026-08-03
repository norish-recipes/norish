import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { SmartTextInputIngredientSuggestion } from "@/components/shared/smart-text-input";
import SmartTextInput from "@/components/shared/smart-text-input";

vi.mock("@/hooks/recipes", () => ({
  useRecipeAutocomplete: () => ({ suggestions: [], isLoading: false }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const SUGGESTIONS: SmartTextInputIngredientSuggestion[] = [
  { key: "1", label: "Ground black pepper", ingredientOrder: 1 },
];

function SmartTextInputHarness({
  onMention,
}: {
  onMention?: (suggestion: SmartTextInputIngredientSuggestion, newValue: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <SmartTextInput
      ingredientSuggestions={SUGGESTIONS}
      placeholder="Step"
      value={value}
      onIngredientMention={
        onMention
          ? (suggestion, newValue) => {
              setValue(newValue);
              onMention(suggestion, newValue);
            }
          : undefined
      }
      onValueChange={setValue}
    />
  );
}

describe("SmartTextInput ingredient mention gesture", () => {
  it("shows ingredient suggestions for at-sign triggers", () => {
    render(<SmartTextInputHarness />);

    fireEvent.change(screen.getByPlaceholderText("Step"), {
      target: { value: "Add @gro" },
    });

    expect(screen.getByText("Ground black pepper")).toBeInTheDocument();
  });

  it("inserts the plain word and reports the mention — the @ never reaches the text", () => {
    const onMention = vi.fn();

    render(<SmartTextInputHarness onMention={onMention} />);

    fireEvent.change(screen.getByPlaceholderText("Step"), {
      target: { value: "Add @gro" },
    });
    fireEvent.click(screen.getByText("Ground black pepper"));

    expect(screen.getByPlaceholderText("Step")).toHaveValue("Add Ground black pepper");
    expect(onMention).toHaveBeenCalledWith(
      expect.objectContaining({ ingredientOrder: 1 }),
      "Add Ground black pepper"
    );
  });

  it("falls back to a plain text change when no mention handler is wired", () => {
    render(<SmartTextInputHarness />);

    fireEvent.change(screen.getByPlaceholderText("Step"), {
      target: { value: "Add @gro" },
    });
    fireEvent.click(screen.getByText("Ground black pepper"));

    expect(screen.getByPlaceholderText("Step")).toHaveValue("Add Ground black pepper");
  });

  it("does not trigger mid-word, so email-like text stays plain", () => {
    render(<SmartTextInputHarness />);

    fireEvent.change(screen.getByPlaceholderText("Step"), {
      target: { value: "Mail chef@gro" },
    });

    expect(screen.queryByText("Ground black pepper")).not.toBeInTheDocument();
  });

  it("uses the nearest trigger when slash autocomplete appears earlier in the step", () => {
    render(<SmartTextInputHarness />);

    fireEvent.change(screen.getByPlaceholderText("Step"), {
      target: { value: "See /sauce and add @gro" },
    });

    expect(screen.getByText("Ground black pepper")).toBeInTheDocument();
  });
});
