import type { ReactNode } from "react";
import { useImportRecipe } from "@/components/imports/use-import-recipe";
import { showActionToast } from "@/lib/ui/action-toast";
import { renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformProvider } from "@norish/shared-react/platform";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { useImportMutations } from "@norish/shared-react/recipes";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toast: vi.fn(),
  importRecipeFromPaste: vi.fn(),
  importRecipeFromImages: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@heroui/react", () => ({ toast: mocks.toast }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("@/lib/ui/action-toast", () => ({ showActionToast: vi.fn() }));
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useImportMutations: vi.fn(() => ({
    importRecipeFromPaste: mocks.importRecipeFromPaste,
    importRecipeFromImages: mocks.importRecipeFromImages,
  })),
}));

const adapter = fakePlatformAdapter();
const wrapper = ({ children }: { children: ReactNode }) => (
  <PlatformProvider adapter={adapter}>{children}</PlatformProvider>
);

beforeEach(() => vi.clearAllMocks());

describe("useImportRecipe", () => {
  it("imports pasted text, says so and goes to the Library", () => {
    const { result } = renderHook(() => useImportRecipe(), { wrapper });

    result.current.importFromPaste("soup");

    expect(mocks.importRecipeFromPaste).toHaveBeenCalledWith("soup");
    expect(mocks.toast).toHaveBeenCalledWith("common.import.paste.importing", {
      description: "common.import.paste.inProgress",
      variant: "default",
    });
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("imports images with the image toast, and stays when asked", () => {
    const files = [new File([""], "page.png")];
    const { result } = renderHook(() => useImportRecipe({ stay: true }), { wrapper });

    result.current.importFromImages(files);

    expect(mocks.importRecipeFromImages).toHaveBeenCalledWith(files);
    expect(mocks.toast).toHaveBeenCalledWith("common.import.image.importing", {
      description: "common.import.image.analyzing",
      variant: "default",
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("says nothing when the import throws", () => {
    mocks.importRecipeFromPaste.mockImplementationOnce(() => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useImportRecipe(), { wrapper });

    expect(() => result.current.importFromPaste("soup")).toThrow("offline");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("offers to open the recipe when the household already holds the URL", () => {
    renderHook(() => useImportRecipe(), { wrapper });
    const onAlreadyExists = vi.mocked(useImportMutations).mock.calls.at(-1)![1]!;

    onAlreadyExists("recipe-held");

    expect(showActionToast).toHaveBeenCalledWith("recipes.import.alreadyExists", {
      action: { label: "recipes.import.openExisting", onPress: expect.any(Function) },
    });
    vi.mocked(showActionToast).mock.calls[0]![1].action.onPress();
    expect(mocks.push).toHaveBeenCalledWith("/recipes/recipe-held");
  });

  it("shows the error toast when an import fails", () => {
    const { show } = adapter.toast;
    renderHook(() => useImportRecipe(), { wrapper });
    const onError = vi.mocked(useImportMutations).mock.calls.at(-1)![0]!;

    onError(new Error("boom"), "importFromUrl");

    expect(show).toHaveBeenCalledExactlyOnceWith({
      severity: "default",
      title: "common.errors.operationFailed",
      description: "common.errors.technicalDetails",
    });
  });

  it("says an import made while Offline is saved, not failed", () => {
    const { show } = adapter.toast;
    renderHook(() => useImportRecipe(), { wrapper });
    const onError = vi.mocked(useImportMutations).mock.calls.at(-1)![0]!;

    // No HTTP status: the backend-unreachable shape the Outbox link captures.
    onError(new TRPCClientError("Failed to fetch"), "importFromUrl");

    expect(show).toHaveBeenCalledExactlyOnceWith({
      severity: "warning",
      title: "common.queuedOffline.title",
      description: "common.queuedOffline.description",
    });
  });
});
