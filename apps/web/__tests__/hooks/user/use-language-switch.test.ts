/**
 * The language switch follows the enabled locales by value: the list it reads
 * may be rebuilt on any render, and following it by identity re-rendered the
 * switch without end on every page.
 */
import { useLanguageSwitch } from "@/hooks/user/use-language-switch";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/user/use-locale", () => ({
  useLocale: () => ({ locale: "nl", changeLocale: vi.fn(), isChanging: false }),
}));

vi.mock("@/hooks/config", () => ({
  // A new list on every call, as a hook that rebuilds it each render hands over.
  useLocaleConfigQuery: () => ({
    enabledLocales: [
      { code: "en", name: "English" },
      { code: "nl", name: "Nederlands" },
    ],
    isLoading: false,
  }),
}));

describe("useLanguageSwitch", () => {
  it("settles on the current locale when the enabled list is rebuilt every render", () => {
    const { result, rerender } = renderHook(() => useLanguageSwitch());

    rerender();
    act(() => rerender());

    expect(result.current.currentLocale).toBe("nl");
  });
});
