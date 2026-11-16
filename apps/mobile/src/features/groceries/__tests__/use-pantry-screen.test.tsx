// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const keep = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@norish/shared-react/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");

  return { useSpellingRules: () => spellingRules({}) };
});
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ toast: { show: vi.fn() } }),
}));
vi.mock("@norish/shared-react/ingredients", () => ({
  useIngredientIcons: () => undefined,
}));
vi.mock("@norish/shared-react/groceries", () => ({
  useOnTheList: () => [],
  usePantryField: () => ({ draft: "oil", setDraft: vi.fn(), typed: "oil", canAdd: true, keep }),
  usePantryQuery: () => ({ items: [], isRead: true, isUnavailable: false }),
  usePantrySuggestions: () => ({ suggestions: [] }),
  usePutOnTheList: () => vi.fn(),
}));

const { usePantryScreen } = await import("../hooks/use-pantry-screen");

describe("the Pantry field", () => {
  it("only narrows: it holds the text and adds nothing", () => {
    const { result } = renderHook(() => usePantryScreen());

    expect(Object.keys(result.current.field)).toEqual(["draft", "setDraft"]);
    expect(keep).not.toHaveBeenCalled();
  });

  it("keeps a suggested food from its row", () => {
    const { result } = renderHook(() => usePantryScreen());

    act(() => result.current.actions.keep({ ingredientId: "i1", name: "Olives" }));

    expect(keep).toHaveBeenCalledWith({ ingredientId: "i1", name: "Olives" });
  });
});
