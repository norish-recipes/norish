/**
 * Image Generation form: clearing the stored key is a change Save can send.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { setConfigs } from "./admin-config-fake";

vi.mock("@norish/shared-react/admin", async () => ({
  useAdminConfig: (await import("./admin-config-fake")).useAdminConfig,
  useImageGenerationConfigWrite: () => () => Promise.resolve(),
  useConfigSecret: () => () => Promise.resolve(null),
  useAvailableModelsQuery: () => ({ models: [], refusal: null, isLoading: false }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const { default: ImageGenerationForm } =
  await import("@/features/admin/components/ai/image-generation-form");

describe("ImageGenerationForm", () => {
  it("enables Save once the stored key is cleared", () => {
    setConfigs({
      image_generation_config: { provider: "openai", model: "gpt-image-1", apiKey: "••••" },
      ai_config: { enabled: false },
    });
    render(<ImageGenerationForm />);
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "clear" }));

    expect(screen.getByRole("button", { name: "save" })).toBeEnabled();
  });
});
