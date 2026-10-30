/**
 * Ingredient catalogue form: what AI does to a new food, one multi-select saved into the AI
 * configuration; Draw missing icons is offered only with an image provider.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const updateAIConfig = vi.fn();
const context = vi.hoisted(() => ({
  aiConfig: undefined as unknown,
  imageGenerationConfig: undefined as unknown,
}));

vi.mock("@/app/(app)/settings/admin/context", () => ({
  useAdminSettingsContext: () => ({ ...context, updateAIConfig }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/app/(app)/settings/admin/components/clean-up-catalogue", () => ({
  default: () => null,
}));
vi.mock("@/app/(app)/settings/admin/components/fill-gaps", () => ({ default: () => null }));

const { default: IngredientCatalogueForm } =
  await import("@/app/(app)/settings/admin/components/ingredient-catalogue-form");

const off = { cleanUp: false, nutrition: false, conversions: false, icon: false };

function options() {
  fireEvent.click(screen.getByRole("button", { name: /automatic/ }));

  return within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.getAttribute("data-key"));
}

describe("IngredientCatalogueForm", () => {
  beforeEach(() => {
    updateAIConfig.mockReset().mockResolvedValue({ success: true });
    context.aiConfig = { enabled: true, model: "m", automaticIngredients: { ...off, icon: true } };
    context.imageGenerationConfig = { provider: "disabled" };
  });

  it("offers Draw missing icons only with an image provider", () => {
    const { unmount } = render(<IngredientCatalogueForm />);

    expect(options()).toEqual(["cleanUp", "nutrition", "conversions"]);
    unmount();

    context.imageGenerationConfig = { provider: "openai" };
    render(<IngredientCatalogueForm />);
    expect(options()).toEqual(["cleanUp", "nutrition", "conversions", "icon"]);
  });

  it("saves the selection into the AI configuration, keeping an icon choice it does not offer", () => {
    render(<IngredientCatalogueForm />);

    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
    options();
    fireEvent.click(screen.getByRole("option", { name: /kinds.cleanUp/ }));
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(updateAIConfig).toHaveBeenCalledWith({
      enabled: true,
      model: "m",
      automaticIngredients: { ...off, cleanUp: true, icon: true },
    });
  });
});
