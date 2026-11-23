// @vitest-environment jsdom
import {
  LocaleSaveScope,
  MobileIntlProvider,
  useMobileLocaleSettings,
} from "@/lib/i18n/mobile-i18n-context";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Each save waits for the test to say whether the server took it.
const saves = vi.hoisted(() => [] as { locale?: string; settle: (took: boolean) => void }[]);
const stored = vi.hoisted(() => new Map<string, string>());
const pending = () => saves.length > 0;

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
  usePreferencesMutation: () => ({
    isUpdatingPreferences: pending(),
    updatePreferences: ({ locale }: { locale?: string }) =>
      new Promise<boolean>((resolve) =>
        saves.push({
          locale,
          settle: (took) => {
            saves.splice(0, 1);
            resolve(took);
          },
        })
      ),
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

const choose = (locale: string, options?: { fromServer?: boolean }) =>
  act(() => shown.setLocale(locale, options));
const settle = (took: boolean) => act(async () => saves[0]?.settle(took));

describe("LocaleSaveScope", () => {
  beforeEach(() => {
    saves.length = 0;
    stored.clear();
  });

  it("shows a picked language at once and saves it", () => {
    renderScope();
    choose("nl");

    expect(shown.locale).toBe("nl");
    expect(saves.map((save) => save.locale)).toEqual(["nl"]);
  });

  it("puts back the language shown before a save the server did not take", async () => {
    renderScope();
    choose("nl");
    await settle(true);
    choose("de-formal");
    await settle(false);

    expect(shown.locale).toBe("nl");
  });

  it("ignores a second choice while a save is in flight", async () => {
    renderScope();
    choose("nl");
    choose("de-formal");

    expect(shown.locale).toBe("nl");
    expect(saves).toHaveLength(1);
  });

  it("applies the server's language without saving it", () => {
    renderScope();
    choose("fr", { fromServer: true });

    expect(shown.locale).toBe("fr");
    expect(saves).toHaveLength(0);
  });
});
