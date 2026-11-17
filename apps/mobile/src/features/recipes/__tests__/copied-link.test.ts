import type { Pasteboard } from "@/features/recipes/utils/copied-link";
import {
  copiedLinkFromPasteboard,
  copiedLinkToOffer,
  firstWebLink,
  isImportableLink,
} from "@/features/recipes/utils/copied-link";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth-headers", () => ({ authHeaders: () => ({}) }));
vi.mock("@/lib/network/server-address", async () => ({
  ServerAddressContext: (await import("react")).createContext(null),
}));

const SERVER = "https://norish.example.com";
const RECIPE = "https://www.seriouseats.com/hoisin-chicken-recipe";

describe("copiedLinkToOffer", () => {
  it("offers a copied recipe link", () => {
    expect(copiedLinkToOffer({ hasUrl: true, text: RECIPE, serverAddress: SERVER })).toBe(RECIPE);
  });

  it("offers it without the spaces around it", () => {
    expect(copiedLinkToOffer({ hasUrl: true, text: ` ${RECIPE}\n`, serverAddress: SERVER })).toBe(
      RECIPE
    );
  });

  it("offers the link inside a sentence", () => {
    expect(
      copiedLinkToOffer({
        hasUrl: true,
        text: `Try this: ${RECIPE} tonight`,
        serverAddress: SERVER,
      })
    ).toBe(RECIPE);
  });

  it("offers nothing when the clipboard holds no URL", () => {
    expect(copiedLinkToOffer({ hasUrl: false, text: null, serverAddress: SERVER })).toBeNull();
    expect(copiedLinkToOffer({ hasUrl: false, text: RECIPE, serverAddress: SERVER })).toBeNull();
  });

  it("offers nothing for a URL that is not a web link", () => {
    for (const text of ["mailto:cook@example.com", "norish://recipe/1", "https://", "", null]) {
      expect(copiedLinkToOffer({ hasUrl: true, text, serverAddress: SERVER })).toBeNull();
    }
  });

  it("offers nothing for a link into the own server", () => {
    expect(
      copiedLinkToOffer({ hasUrl: true, text: `${SERVER}/recipes/1`, serverAddress: SERVER })
    ).toBeNull();
  });

  it("offers a link on a host that only starts like the own server", () => {
    const lookalike = `${SERVER}.evil.test/soup`;

    expect(copiedLinkToOffer({ hasUrl: true, text: lookalike, serverAddress: SERVER })).toBe(
      lookalike
    );
  });

  it("offers a web link while no Server Address is known", () => {
    expect(copiedLinkToOffer({ hasUrl: true, text: RECIPE, serverAddress: null })).toBe(RECIPE);
  });
});

describe("isImportableLink", () => {
  it("takes an http or https link with a host", () => {
    expect(isImportableLink("https://example.com/soup")).toBe(true);
    expect(isImportableLink("http://localhost:3000/recipes/1")).toBe(true);
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

describe("firstWebLink", () => {
  it("finds a lone link, one in a sentence, and the first of two", () => {
    expect(firstWebLink(`${RECIPE}\n`)).toBe(RECIPE);
    expect(firstWebLink(`Try this: ${RECIPE} tonight`)).toBe(RECIPE);
    expect(firstWebLink(`${RECIPE} and https://example.com/other`)).toBe(RECIPE);
  });

  it("adds https:// to a bare domain, with or without a path", () => {
    expect(firstWebLink("example.com/recipe")).toBe("https://example.com/recipe");
    expect(firstWebLink("see www.example.com")).toBe("https://www.example.com");
  });

  it("drops punctuation after a link", () => {
    expect(firstWebLink(`Look (${RECIPE}).`)).toBe(RECIPE);
    expect(firstWebLink("Go to example.com/soup, then cook")).toBe("https://example.com/soup");
  });

  it("finds nothing in text without a link, an email or another scheme", () => {
    for (const text of [
      "soup",
      "cook@example.com",
      "mailto:cook@example.com",
      "ftp://example.com",
    ]) {
      expect(firstWebLink(text)).toBeNull();
    }
  });
});

describe("copiedLinkFromPasteboard", () => {
  const setup = (over: Partial<Pasteboard> = {}) => {
    const pasteboard = {
      probableWebUrl: vi.fn(async () => true),
      hasUrl: vi.fn(async () => false),
      readText: vi.fn(async () => RECIPE as string | null),
      ...over,
    };
    const onError = vi.fn();
    const run = (serverAddress: string | null = SERVER) =>
      copiedLinkFromPasteboard({ pasteboard, serverAddress, onError });

    return { pasteboard, onError, run };
  };

  it("reads nothing when detection says no", async () => {
    const { pasteboard, run } = setup({ probableWebUrl: vi.fn(async () => false) });

    expect(await run()).toBeNull();
    expect(pasteboard.readText).not.toHaveBeenCalled();
  });

  it("reads once and offers the link when detection says yes", async () => {
    const { pasteboard, run } = setup();

    expect(await run()).toBe(RECIPE);
    expect(pasteboard.readText).toHaveBeenCalledTimes(1);
  });

  it("uses hasUrl where the native module is absent", async () => {
    const { pasteboard, run } = setup({ probableWebUrl: null, hasUrl: vi.fn(async () => true) });

    expect(await run()).toBe(RECIPE);
    expect(pasteboard.hasUrl).toHaveBeenCalledTimes(1);
  });

  it("falls back to hasUrl and reports when the native module rejects", async () => {
    const { pasteboard, onError, run } = setup({
      probableWebUrl: vi.fn(async () => Promise.reject(new Error("native"))),
      hasUrl: vi.fn(async () => true),
    });

    expect(await run()).toBe(RECIPE);
    expect(pasteboard.hasUrl).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("offers nothing when the read returns nothing or throws", async () => {
    expect(await setup({ readText: vi.fn(async () => null) }).run()).toBeNull();

    const failing = setup({ readText: vi.fn(async () => Promise.reject(new Error("denied"))) });

    expect(await failing.run()).toBeNull();
    expect(failing.onError).toHaveBeenCalledTimes(1);
  });

  it("offers nothing for a link into the own server", async () => {
    const { run } = setup({ readText: vi.fn(async () => `${SERVER}/recipes/1`) });

    expect(await run()).toBeNull();
  });
});
