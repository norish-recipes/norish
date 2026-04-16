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
    permissions: {
      onPolicyUpdated: {
        subscriptionOptions: vi.fn((_, options) => {
          subscriptionCallbacks.onPolicyUpdated = options?.onData;

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

vi.mock("@/hooks/recipes/use-recipe-query", () => ({
  useRecipeQuery: () => ({
    setRecipeData: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("useRecipeSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(subscriptionCallbacks).forEach((key) => {
      delete subscriptionCallbacks[key];
    });
    queryClient = createTestQueryClient();
  });

  it("shows a generic failure toast instead of backend details", async () => {
    const { useRecipeSubscription } = await import("@/hooks/recipes/use-recipe-subscription");
    const { addToast } = await import("@heroui/react");

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

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "operationFailed",
        description: "technicalDetails",
      })
    );
  });
});
