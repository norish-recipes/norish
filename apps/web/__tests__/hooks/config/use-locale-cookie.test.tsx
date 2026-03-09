import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useLocaleConfigQueryMock = vi.fn();

vi.mock("@/hooks/config", () => ({
  useLocaleConfigQuery: () => useLocaleConfigQueryMock(),
}));

describe("useLocaleCookie", () => {
  beforeEach(() => {
    useLocaleConfigQueryMock.mockReset();
    document.cookie = "NEXT_LOCALE=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("falls back to API default locale when cookie locale is disabled", async () => {
    useLocaleConfigQueryMock.mockReturnValue({
      enabledLocales: [
        { code: "en", name: "English" },
        { code: "fr", name: "Francais" },
      ],
      defaultLocale: "fr",
      isLoading: false,
    });

    document.cookie = "NEXT_LOCALE=es; path=/";

    const { useLocaleCookie } = await import("@/hooks/user/use-locale-cookie");
    const { result } = renderHook(() => useLocaleCookie());

    expect(result.current.locale).toBe("fr");
  });

  it("ignores locale changes that are not enabled", async () => {
    useLocaleConfigQueryMock.mockReturnValue({
      enabledLocales: [{ code: "en", name: "English" }],
      defaultLocale: "en",
      isLoading: false,
    });

    document.cookie = "NEXT_LOCALE=en; path=/";

    const { useLocaleCookie } = await import("@/hooks/user/use-locale-cookie");
    const { result } = renderHook(() => useLocaleCookie());

    act(() => {
      result.current.changeLocale("fr");
    });

    expect(result.current.locale).toBe("en");
  });
});
