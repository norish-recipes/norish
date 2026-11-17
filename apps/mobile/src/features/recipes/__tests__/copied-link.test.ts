import type { Pasteboard } from "@/features/recipes/utils/copied-link";
import {
  copiedLinkFromPasteboard,
  copiedLinkToOffer,
  isImportableLink,
  withScheme,
} from "@/features/recipes/utils/copied-link";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth-headers", () => ({ authHeaders: () => ({}) }));
vi.mock("@/lib/network/server-address", async () => ({
  ServerAddressContext: (await import("react")).createContext(null),
}));

const SERVER = "https://norish.example.com";
const RECIPE = "https://www.seriouseats.com/hoisin-chicken-recipe";

describe("copiedLinkToOffer", () => {
  it("offers a copied recipe link without the spaces around it", () => {
    expect(copiedLinkToOffer(` ${RECIPE}\n`, SERVER)).toBe(RECIPE);
  });

  it("offers nothing for text that is not one web link", () => {
    for (const text of [
      `Try this: ${RECIPE} tonight`,
      "mailto:cook@example.com",
      "norish://recipe/1",
      "https://",
      "",
      null,
    ]) {
      expect(copiedLinkToOffer(text, SERVER)).toBeNull();
    }
  });

  it("offers nothing for a link into the own server", () => {
    expect(copiedLinkToOffer(`${SERVER}/recipes/1`, SERVER)).toBeNull();
  });

  it("offers a link on a host that only starts like the own server", () => {
    const lookalike = `${SERVER}.evil.test/soup`;

    expect(copiedLinkToOffer(lookalike, SERVER)).toBe(lookalike);
  });

  it("offers a web link while no Server Address is known", () => {
    expect(copiedLinkToOffer(RECIPE, null)).toBe(RECIPE);
  });
});

describe("withScheme", () => {
  it("keeps a scheme in any case and http://", () => {
    expect(withScheme("HTTPS://X.COM/a")).toBe("HTTPS://X.COM/a");
    expect(withScheme("http://example.com/a")).toBe("http://example.com/a");
  });

  it("adds https:// to a bare link, port and non-ASCII host untouched", () => {
    expect(withScheme("example.com/recipe")).toBe("https://example.com/recipe");
    expect(withScheme("example.com:8080/x")).toBe("https://example.com:8080/x");
    expect(withScheme("bücher.de/x")).toBe("https://bücher.de/x");
  });
});

describe("isImportableLink", () => {
  it("takes an http or https link with a host, in any case", () => {
    expect(isImportableLink("https://example.com/soup")).toBe(true);
    expect(isImportableLink("http://localhost:3000/recipes/1")).toBe(true);
    expect(isImportableLink("HTTPS://X.COM/a")).toBe(true);
  });

  it("refuses text, other schemes and a link without a host", () => {
    for (const value of [
      "soup",
      "example.com/soup",
      "ftp://example.com",
      "https://",
      "https:// x",
    ]) {
      expect(isImportableLink(value)).toBe(false);
    }
  });
});

describe("copiedLinkFromPasteboard", () => {
  const setup = (
    detection: Partial<NonNullable<Pasteboard["detection"]>> | null = {},
    over: Partial<Omit<Pasteboard, "detection">> = {}
  ) => {
    const pasteboard = {
      detection: detection && {
        hasWebUrl: vi.fn(async () => true),
        webUrl: vi.fn(async () => RECIPE as string | null),
        ...detection,
      },
      hasUrl: vi.fn(async () => true),
      readText: vi.fn(async () => RECIPE as string | null),
      ...over,
    };
    const onError = vi.fn();
    const run = (serverAddress: string | null = SERVER) =>
      copiedLinkFromPasteboard({ pasteboard, serverAddress, onError });

    return { pasteboard, onError, run };
  };

  it("reads nothing when detection says no", async () => {
    const { pasteboard, run } = setup({ hasWebUrl: vi.fn(async () => false) });

    expect(await run()).toBeNull();
    expect(pasteboard.detection?.webUrl).not.toHaveBeenCalled();
    expect(pasteboard.readText).not.toHaveBeenCalled();
  });

  it("reads the detected link once when detection says yes", async () => {
    const { pasteboard, run } = setup();

    expect(await run()).toBe(RECIPE);
    expect(pasteboard.detection?.webUrl).toHaveBeenCalledTimes(1);
    expect(pasteboard.readText).not.toHaveBeenCalled();
  });

  it("adds https:// to a bare detected link", async () => {
    expect(await setup({ webUrl: vi.fn(async () => "example.com/recipe") }).run()).toBe(
      "https://example.com/recipe"
    );
  });

  it("offers nothing for a detected link into the own server", async () => {
    expect(await setup({ webUrl: vi.fn(async () => `${SERVER}/recipes/1`) }).run()).toBeNull();
  });

  it("offers nothing when the detected read returns nothing or throws", async () => {
    expect(await setup({ webUrl: vi.fn(async () => null) }).run()).toBeNull();

    const failing = setup({ webUrl: vi.fn(async () => Promise.reject(new Error("denied"))) });

    expect(await failing.run()).toBeNull();
    expect(failing.onError).toHaveBeenCalledTimes(1);
    expect(failing.pasteboard.readText).not.toHaveBeenCalled();
  });

  it("uses hasUrl and the whole text where the native module is absent", async () => {
    const { pasteboard, run } = setup(null);

    expect(await run()).toBe(RECIPE);
    expect(pasteboard.readText).toHaveBeenCalledTimes(1);
    expect(
      await setup(null, { readText: vi.fn(async () => `Try this: ${RECIPE}`) }).run()
    ).toBeNull();
  });

  it("falls back to hasUrl and reports when detection rejects", async () => {
    const { pasteboard, onError, run } = setup({
      hasWebUrl: vi.fn(async () => Promise.reject(new Error("native"))),
    });

    expect(await run()).toBe(RECIPE);
    expect(pasteboard.hasUrl).toHaveBeenCalledTimes(1);
    expect(pasteboard.detection?.webUrl).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("reads nothing on the fallback when hasUrl says no", async () => {
    const { pasteboard, run } = setup(null, { hasUrl: vi.fn(async () => false) });

    expect(await run()).toBeNull();
    expect(pasteboard.readText).not.toHaveBeenCalled();
  });

  it("offers nothing when the fallback read returns nothing or throws", async () => {
    expect(await setup(null, { readText: vi.fn(async () => null) }).run()).toBeNull();

    const failing = setup(null, {
      readText: vi.fn(async () => Promise.reject(new Error("denied"))),
    });

    expect(await failing.run()).toBeNull();
    expect(failing.onError).toHaveBeenCalledTimes(1);
  });
});
