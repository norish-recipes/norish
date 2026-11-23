import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ApiKeyCard from "@/features/account/components/api-token-card";

const mockKeys = vi.hoisted(() => ({
  createApiKey: vi.fn().mockResolvedValue("nk_secret"),
  forgetCreatedKey: vi.fn(),
  deleteApiKey: vi.fn(),
  toggleApiKey: vi.fn(),
}));

vi.mock("next-intl", () => {
  const t = Object.assign((key: string) => key, { rich: (key: string) => key });

  return { useTranslations: () => t, useFormatter: () => ({ dateTime: String }) };
});

vi.mock("@/components/settings/new-feature-chip", () => ({ default: () => null }));

vi.mock("@norish/shared-react/reader", () => ({
  API_KEY_NAME_MAX_LENGTH: 32,
  apiKeyName: (typed: string) => typed.trim() || undefined,
  apiKeyPrefix: (start: string) => start,
  useApiKeyMutations: () => mockKeys,
  useProfileQuery: () => ({ apiKeys: [] }),
}));

describe("ApiKeyCard", () => {
  it("drops the created key however its dialog closes, Escape included", async () => {
    render(<ApiKeyCard />);

    fireEvent.click(screen.getByRole("button", { name: "createKey" }));
    const dialog = await screen.findByRole("dialog");

    expect(screen.getByDisplayValue("nk_secret")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(mockKeys.forgetCreatedKey).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByDisplayValue("nk_secret")).not.toBeInTheDocument());
  });
});
