import { useRecipesMutations } from "@/hooks/use-recipes-mutations";
import { showActionToast } from "@/lib/ui/action-toast";
import { toast } from "@heroui/react";
import { renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecipesMutations as useSharedRecipesMutations } from "@norish/shared-react/recipes";

const push = vi.hoisted(() => vi.fn());

vi.mock("@heroui/react", () => ({
  toast: Object.assign(vi.fn(), { close: vi.fn() }),
  Button: () => null,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/ui/action-toast", () => ({ showActionToast: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useRecipesMutations: vi.fn(),
}));

/** The error and already-exists handlers web hands the shared hook. */
function webHandlers() {
  renderHook(() => useRecipesMutations());
  const [onError, onAlreadyExists] = vi.mocked(useSharedRecipesMutations).mock.calls.at(-1)!;

  return { onError: onError!, onAlreadyExists: onAlreadyExists! };
}

describe("useRecipesMutations on web", () => {
  beforeEach(() => {
    vi.mocked(toast).mockClear();
    vi.mocked(showActionToast).mockClear();
    push.mockReset();
  });

  it("says the import is saved offline when it was queued, not that it failed", () => {
    // No HTTP status: the backend-unreachable shape the Outbox link captures.
    webHandlers().onError(new TRPCClientError("Failed to fetch"), "import");

    // Key-echo translations: common.queuedOffline.title renders as "title".
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      "title",
      expect.objectContaining({ description: "description", variant: "warning" })
    );
  });

  it("shows a generic failure, not the backend's message, for a rejected import", () => {
    webHandlers().onError(
      new Error("Very long backend stack trace that should not be shown to users"),
      "import"
    );

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      "operationFailed",
      expect.objectContaining({ description: "technicalDetails", variant: "default" })
    );
  });

  it("offers to open the recipe when the household already holds the URL", () => {
    webHandlers().onAlreadyExists("recipe-held");

    expect(showActionToast).toHaveBeenCalledWith("alreadyExists", {
      action: { label: "openExisting", onPress: expect.any(Function) },
    });
    vi.mocked(showActionToast).mock.calls[0]![1].action.onPress();
    expect(push).toHaveBeenCalledWith("/recipes/recipe-held");
  });
});
