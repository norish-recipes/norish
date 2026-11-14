import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlatformProvider } from "@norish/shared-react/platform";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

import { useImportMutations } from "../use-import-mutations";
import { isPasteTooLong, useImportRecipe } from "../use-import-recipe";

const mocks = vi.hoisted(() => ({
  importRecipeFromPaste: vi.fn(),
  importRecipeFromPasteWithAI: vi.fn(),
  importRecipeFromImages: vi.fn(),
}));

vi.mock("../use-import-mutations", () => ({
  useImportMutations: vi.fn(() => ({
    importRecipeFromPaste: mocks.importRecipeFromPaste,
    importRecipeFromPasteWithAI: mocks.importRecipeFromPasteWithAI,
    importRecipeFromImages: mocks.importRecipeFromImages,
  })),
}));

let adapter = fakePlatformAdapter();
const wrapper = ({ children }: { children: ReactNode }) => (
  <PlatformProvider adapter={adapter}>{children}</PlatformProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  adapter = fakePlatformAdapter();
});

describe("useImportRecipe", () => {
  it("imports pasted text, says so and goes to the Library", () => {
    const { result } = renderHook(() => useImportRecipe(), { wrapper });

    result.current.importFromPaste("soup");

    expect(mocks.importRecipeFromPaste).toHaveBeenCalledWith("soup", undefined);
    expect(adapter.toast.show).toHaveBeenCalledWith({
      severity: "default",
      title: "common.import.paste.importing",
      description: "common.import.paste.inProgress",
    });
    expect(adapter.navigation.toHome).toHaveBeenCalledTimes(1);
  });

  it("imports images with the image toast, and stays when asked", () => {
    const files = [new Blob([""], { type: "image/png" })];
    const { result } = renderHook(() => useImportRecipe({ stay: true }), { wrapper });

    result.current.importFromImages(files);

    expect(mocks.importRecipeFromImages).toHaveBeenCalledWith(files, undefined);
    expect(adapter.toast.show).toHaveBeenCalledWith({
      severity: "default",
      title: "common.import.image.importing",
      description: "common.import.image.analyzing",
    });
    expect(adapter.navigation.toHome).not.toHaveBeenCalled();
  });

  it("says a caller's kept import only once the server queued it", () => {
    const { result } = renderHook(() => useImportRecipe({ stay: true }), { wrapper });
    const keeps = () => true;

    result.current.importFromPaste("soup", { keeps });

    expect(adapter.toast.show).not.toHaveBeenCalled();
    const [, options] = mocks.importRecipeFromPaste.mock.calls[0]!;

    expect(options).toMatchObject({ keeps });
    options.onAccepted();
    expect(adapter.toast.show).toHaveBeenCalledExactlyOnceWith({
      severity: "default",
      title: "common.import.paste.importing",
      description: "common.import.paste.inProgress",
    });
  });

  it("says nothing when the import throws", () => {
    mocks.importRecipeFromPaste.mockImplementationOnce(() => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useImportRecipe(), { wrapper });

    expect(() => result.current.importFromPaste("soup")).toThrow("offline");
    expect(adapter.toast.show).not.toHaveBeenCalled();
    expect(adapter.navigation.toHome).not.toHaveBeenCalled();
  });

  it("offers to open the recipe when the household already holds the URL", () => {
    renderHook(() => useImportRecipe(), { wrapper });
    const onAlreadyExists = vi.mocked(useImportMutations).mock.calls.at(-1)![1]!;

    onAlreadyExists("recipe-held");

    expect(adapter.toast.show).toHaveBeenCalledWith({
      severity: "default",
      title: "recipes.import.alreadyExists",
      actionLabel: "recipes.import.openExisting",
      onActionPress: expect.any(Function),
    });
    vi.mocked(adapter.toast.show).mock.calls[0]![0].onActionPress!();
    expect(adapter.navigation.toRecipe).toHaveBeenCalledWith("recipe-held");
  });

  it("shows the error toast when an import fails", () => {
    renderHook(() => useImportRecipe(), { wrapper });
    const onError = vi.mocked(useImportMutations).mock.calls.at(-1)![0]!;

    onError(new Error("boom"), "importFromUrl");

    expect(adapter.toast.show).toHaveBeenCalledExactlyOnceWith({
      severity: "default",
      title: "common.import.paste.failed",
      description: "common.errors.technicalDetails",
    });
  });

  it("says an import made while Offline is saved, not failed", () => {
    renderHook(() => useImportRecipe(), { wrapper });
    const onError = vi.mocked(useImportMutations).mock.calls.at(-1)![0]!;

    // No HTTP status: the backend-unreachable shape the Outbox link captures.
    onError(new TRPCClientError("Failed to fetch"), "importFromUrl");

    expect(adapter.toast.show).toHaveBeenCalledExactlyOnceWith({
      severity: "warning",
      title: "common.queuedOffline.title",
      description: "common.queuedOffline.description",
    });
  });

  it("refuses an AI paste import over the length cap with a warning", () => {
    const { result } = renderHook(() => useImportRecipe(), { wrapper });

    expect(
      result.current.importFromPasteWithAI(`  ${"a".repeat(MAX_RECIPE_PASTE_CHARS + 1)}  `)
    ).toBe(false);
    expect(mocks.importRecipeFromPasteWithAI).not.toHaveBeenCalled();
    expect(adapter.toast.show).toHaveBeenCalledExactlyOnceWith({
      severity: "warning",
      title: "common.import.paste.tooLarge",
      description: "common.import.paste.maxCharacters",
    });
    expect(adapter.navigation.toHome).not.toHaveBeenCalled();
  });

  it("starts an AI paste import at the cap, surrounding spaces aside", () => {
    const text = ` ${"a".repeat(MAX_RECIPE_PASTE_CHARS)} `;
    const { result } = renderHook(() => useImportRecipe(), { wrapper });

    expect(result.current.importFromPasteWithAI(text)).toBe(true);
    expect(mocks.importRecipeFromPasteWithAI).toHaveBeenCalledWith(text, undefined);
    expect(adapter.toast.show).toHaveBeenCalledWith({
      severity: "default",
      title: "common.import.paste.importingWithAI",
      description: "common.import.paste.inProgress",
    });
  });
});

describe("isPasteTooLong", () => {
  it("measures the text without the spaces around it", () => {
    expect(isPasteTooLong(` ${"a".repeat(MAX_RECIPE_PASTE_CHARS)}\n`)).toBe(false);
    expect(isPasteTooLong("a".repeat(MAX_RECIPE_PASTE_CHARS + 1))).toBe(true);
  });
});
