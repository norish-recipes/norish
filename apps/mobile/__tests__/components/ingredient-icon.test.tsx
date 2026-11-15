// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ show: true, address: null as string | null | undefined }));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    View: ({ className, children }: { className?: string; children?: React.ReactNode }) =>
      createElement("div", { "data-testid": "slot", className }, children),
    Image: () => createElement("img", { "data-testid": "image" }),
  };
});
vi.mock("@/lib/network/server-url", () => ({ useServerImage: () => (address: string) => address }));
vi.mock("@norish/shared-react/ingredients", () => ({
  useIngredientIconAddress: () => state.address,
}));
vi.mock("@norish/shared-react/reader", () => ({
  useHiddenItemVisibility: () => ({ showIngredientIcons: state.show }),
}));

const { IngredientIcon } = await import("@/components/ingredient-icon");

describe("IngredientIcon", () => {
  beforeEach(() => {
    state.show = true;
    state.address = null;
  });

  it("draws a grey circle for a food with no icon, and for one not synced yet", () => {
    render(<IngredientIcon ingredientId="" />);

    expect(screen.getByTestId("slot").className).toBe("bg-default");
    expect(screen.queryByTestId("image")).toBeNull();
  });

  it("draws the picture, not the circle, where the food has an icon", () => {
    state.address = "/icons/salt.svg";
    render(<IngredientIcon ingredientId="i1" />);

    expect(screen.getByTestId("slot").className).toBe("");
    expect(screen.queryByTestId("image")).not.toBeNull();
  });

  it("draws nothing when the reader hides ingredient icons", () => {
    state.show = false;
    render(<IngredientIcon ingredientId="i1" />);

    expect(screen.queryByTestId("slot")).toBeNull();
  });
});
