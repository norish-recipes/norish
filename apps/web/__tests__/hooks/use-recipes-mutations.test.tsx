import type { ReactNode } from "react";
import { useRecipesMutations } from "@/hooks/use-recipes-mutations";
import { showActionToast } from "@/lib/ui/action-toast";
import { toast } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const importFromUrl = vi.hoisted(() => vi.fn());
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

vi.mock("@norish/shared-react/trpc", () => {
  const key =
    (...path: string[]) =>
    (input?: unknown) => [path, ...(input === undefined ? [] : [{ input }])];
  const procedure = (mutationFn: (input: unknown) => unknown) => ({
    mutationOptions: (options?: object) => ({ ...options, mutationFn }),
  });

  return {
    useTRPC: () => ({
      recipes: {
        list: { queryKey: key("recipes", "list") },
        get: { queryKey: key("recipes", "get") },
        getPending: { queryKey: key("recipes", "getPending") },
        importFromUrl: procedure(importFromUrl),
        importFromImages: procedure(vi.fn()),
        importFromPaste: procedure(vi.fn()),
        create: procedure(vi.fn()),
        update: procedure(vi.fn()),
        delete: procedure(vi.fn()),
        convertMeasurements: procedure(vi.fn()),
      },
      library: { list: { queryKey: key("library", "list") } },
    }),
  };
});

describe("useRecipesMutations on web", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.mocked(toast).mockClear();
    importFromUrl.mockReset();
    push.mockReset();
    vi.mocked(showActionToast).mockClear();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  async function importAnswered(answer: () => Promise<unknown>) {
    importFromUrl.mockImplementation(answer);
    const { result } = renderHook(() => useRecipesMutations(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    act(() => result.current.importRecipe("https://example.com/recipe"));
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
  }

  it("says the import is saved offline when it was queued, not that it failed", async () => {
    // No HTTP status: the backend-unreachable shape the Outbox link captures.
    await importAnswered(() => Promise.reject(new TRPCClientError("Failed to fetch")));

    // Key-echo translations: common.queuedOffline.title renders as "title".
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      "title",
      expect.objectContaining({ description: "description", variant: "warning" })
    );
  });

  it("shows a generic failure, not the backend's message, for a rejected import", async () => {
    await importAnswered(() =>
      Promise.reject(new Error("Very long backend stack trace that should not be shown to users"))
    );

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      "operationFailed",
      expect.objectContaining({ description: "technicalDetails", variant: "default" })
    );
  });

  it("offers to open the recipe when the household already holds the URL", async () => {
    await importAnswered(() => Promise.resolve({ recipeId: "recipe-held", status: "exists" }));

    expect(showActionToast).toHaveBeenCalledWith("alreadyExists", {
      action: { label: "openExisting", onPress: expect.any(Function) },
    });
    vi.mocked(showActionToast).mock.calls[0]![1].action.onPress();
    expect(push).toHaveBeenCalledWith("/recipes/recipe-held");
  });
});
