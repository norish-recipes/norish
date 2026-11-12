import { useRecipesMutations } from "@/hooks/use-recipes-mutations";
import { toast } from "@heroui/react";
import { renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecipesMutations as useSharedRecipesMutations } from "@norish/shared-react/recipes";

vi.mock("@heroui/react", () => ({
  toast: Object.assign(vi.fn(), { close: vi.fn() }),
  Button: () => null,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useRecipesMutations: vi.fn(),
}));

/** The error handler web hands the shared hook. */
function onError() {
  renderHook(() => useRecipesMutations());

  return vi.mocked(useSharedRecipesMutations).mock.calls.at(-1)![0]!;
}

describe("useRecipesMutations on web", () => {
  beforeEach(() => {
    vi.mocked(toast).mockClear();
  });

  it("says the change is saved offline when it was queued, not that it failed", () => {
    // No HTTP status: the backend-unreachable shape the Outbox link captures.
    onError()(new TRPCClientError("Failed to fetch"), "create");

    // Key-echo translations: common.queuedOffline.title renders as "title".
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      "title",
      expect.objectContaining({ description: "description", variant: "warning" })
    );
  });

  it("shows a generic failure, not the backend's message, for a rejected create", () => {
    onError()(
      new Error("Very long backend stack trace that should not be shown to users"),
      "create"
    );

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      "operationFailed",
      expect.objectContaining({ description: "technicalDetails", variant: "default" })
    );
  });
});
