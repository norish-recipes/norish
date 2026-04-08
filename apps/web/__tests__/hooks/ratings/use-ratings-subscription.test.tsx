import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

const subscriptionCallbacks: Record<string, ((data: unknown) => void) | undefined> = {};

function emitPayload(payload: unknown) {
  return { payload };
}

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    recipes: {
      list: {
        queryKey: () => [["recipes", "list"], { input: {}, type: "infinite" }],
      },
    },
    ratings: {
      getAverage: {
        queryKey: ({ recipeId }: { recipeId: string }) => [
          ["ratings", "getAverage"],
          { input: { recipeId }, type: "query" },
        ],
      },
      getUserRating: {
        queryKey: ({ recipeId }: { recipeId: string }) => [
          ["ratings", "getUserRating"],
          { input: { recipeId }, type: "query" },
        ],
      },
      onRatingUpdated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onRatingUpdated = options?.onData;

          return { enabled: true };
        }),
      },
      onRatingFailed: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onRatingFailed = options?.onData;

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
  addToast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("useRatingsSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(subscriptionCallbacks).forEach((key) => {
      delete subscriptionCallbacks[key];
    });
    queryClient = createTestQueryClient();
  });

  it("shows generic toast copy for rating failures", async () => {
    const { useRatingsSubscription } = await import("@/hooks/ratings/use-ratings-subscription");
    const { addToast } = await import("@heroui/react");

    renderHook(() => useRatingsSubscription(), {
      wrapper: createTestWrapper(queryClient),
    });

    act(() => {
      subscriptionCallbacks.onRatingFailed?.(
        emitPayload({
          recipeId: "recipe-1",
          reason: "Very long backend stack trace that should not be shown in toast",
        })
      );
    });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "operationFailed",
        description: "technicalDetails",
      })
    );
  });
});
