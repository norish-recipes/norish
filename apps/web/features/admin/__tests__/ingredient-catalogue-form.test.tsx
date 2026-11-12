/**
 * Ingredient catalogue form: what AI does to a new food, one multi-select saved into the AI
 * configuration; Draw missing icons is offered only with an image provider.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { configs, setConfigs } from "./admin-config-fake";

const updateAIConfig = vi.fn();

vi.mock("@norish/shared-react/admin", async () => ({
  useAdminConfig: (await import("./admin-config-fake")).useAdminConfig,
  useAIConfigWrite: () => ({ save: updateAIConfig }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/admin/components/catalogue/clean-up-catalogue", () => ({
  default: () => null,
}));
vi.mock("@/features/admin/components/catalogue/fill-gaps", () => ({ default: () => null }));

const { default: IngredientCatalogueForm } =
  await import("@/features/admin/components/catalogue/ingredient-catalogue-form");

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
    setConfigs({
      ai_config: { enabled: true, model: "m", automaticIngredients: { ...off, icon: true } },
      image_generation_config: { provider: "disabled" },
    });
  });

  it("offers Draw missing icons only with an image provider", () => {
    const { unmount } = render(<IngredientCatalogueForm />);

    expect(options()).toEqual(["cleanUp", "nutrition", "conversions"]);
    unmount();

    configs.image_generation_config = { provider: "openai" };
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
