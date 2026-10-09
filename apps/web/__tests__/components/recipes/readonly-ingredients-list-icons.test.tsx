/**
 * A recipe's ingredient lines and their Ingredient Icons: a line that names
 * a food shows its icon; a food with none, a heading and a line that names
 * no food ("200 g" alone) show nothing.
 */
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-amount-display-preference", () => ({
  useAmountDisplayPreference: () => ({ mode: "decimal" }),
}));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({ formatUnitOnly: (unit: string) => unit }),
}));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const ICON = "/ingredient-icons/0123456789abcdef0123456789abcdef.webp";

function line(ingredientName: string, order: number, icon: string | null = null) {
  return { ingredientName, amount: null, unit: null, systemUsed: "metric", order, icon };
}

describe("ReadonlyIngredientsList", () => {
  it("gives a food's line its icon, and a food with none, a heading or a line with no food nothing", () => {
    render(
      <ReadonlyIngredientsList
        ingredients={[
          line("# Base", 0),
          line("onion", 1, ICON),
          line("kohlrabi", 2),
          line("200 g", 3),
        ]}
        systemUsed="metric"
      />
    );

    expect(screen.getByTestId("ingredient-icon").getAttribute("src")).toBe(ICON);
    expect(screen.getAllByTestId("ingredient-icon")).toHaveLength(1);
    expect(screen.queryByTestId("ingredient-icon-placeholder")).toBeNull();
  });
});
