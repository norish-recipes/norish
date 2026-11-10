import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackedEvent } from "../../hooks/realtime-test-utils";

const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const createTestWrapper = (queryClient: QueryClient) =>
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

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
      await import("@/app/(app)/recipes/[id]/components/use-recipe-subscription");
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
