import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sharedHook: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("react", () => ({ useCallback: (callback: unknown) => callback }));
vi.mock("@/context/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("heroui-native", () => ({
  Toast: Object.assign(() => null, {
    Title: () => null,
    Description: () => null,
  }),
  useToast: () => ({ toast: { show: mocks.showToast } }),
}));
vi.mock("@/hooks/recipes/shared-recipe-hooks", () => ({
  sharedRecipeFamilyHooks: { useRecipeEnrichment: mocks.sharedHook },
}));

const { useRecipeEnrichment } = await import("@/hooks/recipes/use-recipe-enrichment");

describe("mobile Recipe Enrichment adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("identifies the requester and turns manual failures into a native toast", () => {
    useRecipeEnrichment("recipe-1");

    expect(mocks.sharedHook).toHaveBeenCalledWith(
      "recipe-1",
      "user-1",
      expect.objectContaining({ onManualError: expect.any(Function) })
    );

    const callbacks = mocks.sharedHook.mock.calls[0]?.[2] as {
      onManualError: (kind: "auto-tagging", error: Error) => void;
    };

    callbacks.onManualError("auto-tagging", new Error("provider refused"));

    expect(mocks.showToast).toHaveBeenCalledWith({ component: expect.any(Function) });
  });
});
