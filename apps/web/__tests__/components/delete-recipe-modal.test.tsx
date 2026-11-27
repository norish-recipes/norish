import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("DeleteRecipeModal", () => {
  it("renders above the mobile nav stack", () => {
    render(<DeleteRecipeModal isOpen recipeName="Soup" onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(document.querySelector(".z-\\[1100\\]")).not.toBeNull();
  });

  it("keeps Cancel on the left and the red Delete on the right", () => {
    render(<DeleteRecipeModal isOpen recipeName="Soup" onClose={vi.fn()} onConfirm={vi.fn()} />);

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent)
      .filter(Boolean);

    expect(labels).toEqual(["cancel", "delete"]);
  });
});
