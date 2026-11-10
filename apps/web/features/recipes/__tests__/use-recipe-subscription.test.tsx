import { trackedEvent } from "@/__tests__/hooks/realtime-test-utils";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

const subscriptionCallbacks: Record<string, ((data: unknown) => void) | undefined> = {};

function emitPayload(payload: unknown) {
  return trackedEvent(payload);
}

vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({
    recipes: {
      get: {
        queryKey: vi.fn(() => ["recipes", "get"]),
        queryOptions: vi.fn((input) => ({
          queryKey: ["recipes", "get", input],
          queryFn: vi.fn(),
        })),
      },
      onUpdated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onUpdated = options?.onData;

          return { enabled: true };
        }),
      },
      onConverted: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onConverted = options?.onData;

          return { enabled: true };
        }),
      },
      onDeleted: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onDeleted = options?.onData;

          return { enabled: true };
        }),
      },
      onFailed: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onFailed = options?.onData;

          return { enabled: true };
        }),
      },
    },
  }),
}));

vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: vi.fn((options) => {
    if (typeof options === "function") {
      options();
    }
  }),
}));

vi.mock("@heroui/react", () => ({
  toast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("useRecipeSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    Object.keys(subscriptionCallbacks).forEach((key) => {
      delete subscriptionCallbacks[key];
    });
    queryClient = createTestQueryClient();
  });

  it("shows a generic failure toast instead of backend details", async () => {
    const { useRecipeSubscription } =
      await import("@/features/recipes/hooks/use-recipe-subscription");
    const { toast } = await import("@heroui/react");

    renderHook(() => useRecipeSubscription("recipe-1"), {
      wrapper: createTestWrapper(queryClient),
    });

    act(() => {
      subscriptionCallbacks.onFailed?.(
        emitPayload({
          recipeId: "recipe-1",
          reason: "Very long backend stack trace that should not be shown in toast",
        })
      );
    });

    expect(toast).toHaveBeenCalledWith(
      "operationFailed",
      expect.objectContaining({
        description: "technicalDetails",
        variant: "danger",
      })
    );
  });
});
