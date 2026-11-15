// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const keep = vi.hoisted(() => vi.fn());

vi.mock("react-native", () => ({ TextInput: () => null }));
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
  usePantryCatalogue: () => [],
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
  it("takes focus again after a typed add and after a picked food", () => {
    const { result } = renderHook(() => usePantryScreen());
    const focus = vi.fn();

    result.current.field.ref.current = { focus } as never;
    act(() => result.current.field.add());
    act(() => result.current.actions.keep({ ingredientId: "i1", name: "Olives" }));

    expect(keep).toHaveBeenNthCalledWith(1, "oil");
    expect(keep).toHaveBeenNthCalledWith(2, { ingredientId: "i1", name: "Olives" });
    expect(focus).toHaveBeenCalledTimes(2);
  });
});
