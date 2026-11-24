// @vitest-environment jsdom
import { useSyncExternalStore } from "react";
import { LocaleSaveScope } from "@/lib/i18n/locale-save-scope";
import { MobileIntlProvider, useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The profile cache's saved language, written as the real save does: optimistic, rolled back on a
// refusal or failure, the server's on a stale answer. Each save waits for the test to settle it.
const cache = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { locale: undefined as string | undefined };

  return {
    state,
    set: (locale: string | undefined) => {
      state.locale = locale;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => void listeners.delete(listener);
    },
  };
});
type Outcome = "took" | "refused" | "failed" | { stale: string | undefined };
const saves = vi.hoisted(() => [] as { locale?: string; settle: (outcome: Outcome) => void }[]);
const stored = vi.hoisted(() => new Map<string, string>());

vi.mock("react-native", () => ({ Platform: { OS: "ios" }, Settings: { get: () => ["en"] } }));
vi.mock("@/lib/storage/mmkv", () => ({
  storage: {
    getString: (key: string) => stored.get(key),
    set: (key: string, value: string) => void stored.set(key, value),
  },
}));
vi.mock("@norish/i18n/messages", () => ({ loadLocaleMessages: async () => ({}) }));
vi.mock("@norish/shared-react/config", () => ({
  useLocaleConfigQuery: () => ({ enabledLocales: [], defaultLocale: "en", isLoading: false }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  useSavedLocale: () => useSyncExternalStore(cache.subscribe, () => cache.state.locale),
  usePreferencesMutation: () => ({
    isUpdatingPreferences: saves.length > 0,
    updatePreferences: ({ locale }: { locale?: string }) => {
      const previous = cache.state.locale;

      cache.set(locale);

      return new Promise<boolean>((resolve) =>
        saves.push({
          locale,
          settle: (outcome) => {
            saves.splice(0, 1);
            if (outcome === "refused" || outcome === "failed") cache.set(previous);
            else if (outcome !== "took") cache.set(outcome.stale);
            resolve(outcome === "took");
          },
        })
      );
    },
  }),
}));

let shown: ReturnType<typeof useMobileLocaleSettings>;

function Probe() {
  shown = useMobileLocaleSettings();

  return null;
}

const renderScope = () =>
  render(
    <MobileIntlProvider signedIn>
      <LocaleSaveScope>
        <Probe />
      </LocaleSaveScope>
    </MobileIntlProvider>
  );

const choose = (locale: string) => act(() => shown.setLocale(locale));
const settle = (outcome: Outcome) => act(async () => saves[0]?.settle(outcome));
const ownLanguage = () => JSON.parse(stored.get("preferences.locale") ?? "{}").locale;

describe("the shown language", () => {
  beforeEach(() => {
    saves.length = 0;
    stored.clear();
    cache.state.locale = undefined;
  });

  it("is the saved one, applied from the server or picked here and shown at once", () => {
    cache.state.locale = "fr";
    renderScope();
    expect(shown.locale).toBe("fr");

    choose("nl");
    expect(shown.locale).toBe("nl");
    expect(saves.map((save) => save.locale)).toEqual(["nl"]);
  });

  it("goes back to the saved one when the server refuses or the write fails", async () => {
    cache.state.locale = "nl";
    renderScope();

    choose("de-formal");
    await settle("refused");
    expect(shown.locale).toBe("nl");

    choose("de-formal");
    await settle("failed");
    expect(shown.locale).toBe("nl");
  });

  it("is the server's on a stale answer, which nothing undoes", async () => {
    cache.state.locale = "en";
    renderScope();

    choose("nl");
    await settle({ stale: "fr" });
    expect(shown.locale).toBe("fr");
    expect(ownLanguage()).toBe("fr");
  });

  it("is the device's own again when a first save fails, kept for the next launch", async () => {
    stored.set("preferences.locale", JSON.stringify({ locale: "fr" }));
    renderScope();

    choose("nl");
    expect(ownLanguage()).toBe("nl");
    await settle("failed");

    expect(shown.locale).toBe("fr");
    expect(ownLanguage()).toBe("fr");
  });

  it("ignores a second choice while a save is in flight", () => {
    renderScope();
    choose("nl");
    choose("de-formal");

    expect(shown.locale).toBe("nl");
    expect(saves).toHaveLength(1);
  });
});
