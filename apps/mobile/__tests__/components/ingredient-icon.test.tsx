// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  show: true,
  address: null as string | null | undefined,
  listHasIcon: false,
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    View: ({ className, children }: { className?: string; children?: React.ReactNode }) =>
      createElement("div", { "data-testid": "slot", className }, children),
  };
});
vi.mock("@/components/server-image", async () => {
  const { createElement } = await import("react");

  return { ServerImage: () => createElement("img", { "data-testid": "image" }) };
});
vi.mock("@norish/shared-react/ingredients", () => ({
  useIngredientIconAddress: () => state.address,
  useListHasIcon: () => state.listHasIcon,
}));
vi.mock("@norish/shared-react/reader", () => ({
  useHiddenItemVisibility: () => ({ showIngredientIcons: state.show }),
}));

const { IngredientIcon, IngredientIconSlots } = await import("@/components/ingredient-icon");

describe("IngredientIcon", () => {
  beforeEach(() => {
    state.show = true;
    state.address = null;
    state.listHasIcon = false;
  });

  it("draws nothing for a food with no icon where no food of its list has one", () => {
    render(
      <IngredientIconSlots ids={["i1"]}>
        <IngredientIcon ingredientId="i1" />
      </IngredientIconSlots>
    );

    expect(screen.queryByTestId("slot")).toBeNull();
    expect(screen.queryByTestId("image")).toBeNull();
  });

  it("keeps an empty slot for a food with no icon where another food of its list has one", () => {
    state.listHasIcon = true;
    render(
      <IngredientIconSlots ids={["i1", "i2"]}>
        <IngredientIcon ingredientId="i1" />
      </IngredientIconSlots>
    );

    expect(screen.queryByTestId("slot")).not.toBeNull();
    expect(screen.queryByTestId("image")).toBeNull();
  });

  it("draws the picture, not the circle, where the food has an icon", () => {
    state.address = "/icons/salt.svg";
    render(<IngredientIcon ingredientId="i1" />);

    expect(screen.queryByTestId("image")).not.toBeNull();
  });

  it("draws nothing when the reader hides ingredient icons", () => {
    state.show = false;
    render(<IngredientIcon ingredientId="i1" />);

    expect(screen.queryByTestId("slot")).toBeNull();
  });
});
