import { buildBookmarklet, readImportLink } from "@/lib/import-link";
import { describe, expect, it } from "vitest";

describe("readImportLink", () => {
  const LINK = "https://example.com/recipes/soup";

  it("reads the link a bookmarklet sends", () => {
    expect(readImportLink({ url: LINK, text: undefined })).toBe(LINK);
  });

  it("finds the link a share sheet leaves in the text, after the page's title", () => {
    expect(readImportLink({ url: "", text: `Best soup ${LINK}` })).toBe(LINK);
  });

  it("uses the first of a repeated parameter", () => {
    expect(readImportLink({ url: [LINK, "https://example.com/other"], text: undefined })).toBe(
      LINK
    );
  });

  it.each([
    ["nothing", undefined],
    ["words", "not a link"],
    ["a script address", "javascript:alert(1)"],
    ["another scheme", "ftp://example.com/soup"],
  ])("has no link for %s", (_name, url) => {
    expect(readImportLink({ url, text: undefined })).toBeNull();
  });
});

describe("buildBookmarklet", () => {
  const code = buildBookmarklet("https://norish.example/base/import", "a+code");

  /** Runs the bookmarklet against a stand-in for the page's window. */
  function run(openResult: object | null, href = "https://blog.example/soup?a=1&b=2") {
    const open = (..._args: unknown[]) => openResult;
    const calls: unknown[][] = [];
    const location = { href };
    const window = {
      open: (...args: unknown[]) => {
        calls.push(args);

        return open(...args);
      },
    };

    new Function("window", "location", code.slice("javascript:".length))(window, location);

    return { calls, location };
  }

  const EXPECTED =
    "https://norish.example/base/import?code=a%2Bcode&url=https%3A%2F%2Fblog.example%2Fsoup%3Fa%3D1%26b%3D2";

  it("is a javascript: address", () => {
    expect(code.startsWith("javascript:")).toBe(true);
  });

  it("opens the import page in a new tab with the page's address encoded", () => {
    const { calls, location } = run({});

    expect(calls).toEqual([[EXPECTED, "_blank"]]);
    expect(location.href).toBe("https://blog.example/soup?a=1&b=2");
  });

  it("uses the current tab when the pop-up is blocked", () => {
    expect(run(null).location.href).toBe(EXPECTED);
  });
});
