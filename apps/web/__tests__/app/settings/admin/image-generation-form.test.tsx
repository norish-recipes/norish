/**
 * Image Generation form: clearing the stored key is a change Save can send.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

// One object across renders, as the context hands out.
const settings = vi.hoisted(() => ({
  imageGenerationConfig: { provider: "openai", model: "gpt-image-1", apiKey: "••••" },
  aiConfig: { enabled: false },
  updateImageGenerationConfig: () => Promise.resolve(),
  fetchConfigSecret: () => Promise.resolve(null),
}));

vi.mock("@/app/(app)/settings/admin/context", () => ({
  useAdminSettingsContext: () => settings,
}));

vi.mock("@/hooks/admin", () => ({
  useAvailableModelsQuery: () => ({ models: [], refusal: null, isLoading: false }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const { default: ImageGenerationForm } =
  await import("@/app/(app)/settings/admin/components/image-generation-form");

describe("ImageGenerationForm", () => {
  it("enables Save once the stored key is cleared", () => {
    render(<ImageGenerationForm />);
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "clear" }));

    expect(screen.getByRole("button", { name: "save" })).toBeEnabled();
  });
});
