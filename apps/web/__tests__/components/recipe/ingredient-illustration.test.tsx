import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { IngredientIllustration } from "@/components/recipes/ingredient-illustration";
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";
import { HiddenItemsProvider } from "@/context/hidden-items-context";

vi.mock("@/hooks/use-amount-display-preference", () => ({
  useAmountDisplayPreference: () => ({ mode: "decimal" }),
}));

vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({ formatUnitOnly: (unit: string | null) => unit ?? "" }),
}));

vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const LINES = [
  {
    ingredientName: "eggs",
    amount: 3,
    unit: null,
    systemUsed: "metric",
    order: 0,
    picture: { imageUrl: "/ingredient-images/egg.webp" },
  },
  {
    ingredientName: "chives",
    amount: null,
    unit: null,
    systemUsed: "metric",
    order: 1,
    picture: null,
  },
];

describe("IngredientIllustration", () => {
  it("is a decorative picture, since the name beside it is the label", () => {
    render(<IngredientIllustration imageUrl="/ingredient-images/egg.webp" />);

    const picture = screen.getByTestId("ingredient-illustration");

    expect(picture).toHaveAttribute("src", "/ingredient-images/egg.webp");
    expect(picture).toHaveAttribute("alt", "");
  });

  it("renders nothing without a picture, or once the file fails to load", () => {
    const { rerender } = render(<IngredientIllustration imageUrl={null} />);

    expect(screen.queryByTestId("ingredient-illustration")).not.toBeInTheDocument();

    rerender(<IngredientIllustration imageUrl="/ingredient-images/gone.webp" />);
    fireEvent.error(screen.getByTestId("ingredient-illustration"));

    expect(screen.queryByTestId("ingredient-illustration")).not.toBeInTheDocument();
  });

  it("shows everything outside the signed-in shell, where no Hidden Items exist", () => {
    render(<ReadonlyIngredientsList ingredients={LINES} systemUsed="metric" />);

    expect(screen.getAllByTestId("ingredient-illustration")).toHaveLength(1);
  });

  it("is hidden for a reader who hid ingredient pictures, except in administration", () => {
    render(
      <HiddenItemsProvider initialHiddenItems={["ingredientPictures"]}>
        <ReadonlyIngredientsList ingredients={LINES} systemUsed="metric" />
        <IngredientIllustration ignoreHidden imageUrl="/ingredient-images/admin.webp" />
      </HiddenItemsProvider>
    );

    const pictures = screen.getAllByTestId("ingredient-illustration");

    expect(pictures).toHaveLength(1);
    expect(pictures[0]).toHaveAttribute("src", "/ingredient-images/admin.webp");
  });
});
