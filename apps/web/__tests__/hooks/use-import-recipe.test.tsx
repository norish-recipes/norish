import { useImportRecipe } from "@/hooks/use-import-recipe";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/hooks/use-recipes-mutations", () => ({
  useRecipesMutations: () => ({
    importRecipeFromPaste: mocks.importRecipeFromPaste,
    importRecipeFromImages: mocks.importRecipeFromImages,
  }),
}));

beforeEach(() => vi.clearAllMocks());

describe("useImportRecipe", () => {
  it("imports pasted text, says so and goes to the Library", () => {
    const { result } = renderHook(() => useImportRecipe());

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
    const { result } = renderHook(() => useImportRecipe({ stay: true }));

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
    const { result } = renderHook(() => useImportRecipe());

    expect(() => result.current.importFromPaste("soup")).toThrow("offline");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
