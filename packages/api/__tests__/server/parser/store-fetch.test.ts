// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchStorePage } from "@norish/api/parser/store-fetch";

const renderPage = vi.hoisted(() => vi.fn<(url: string) => Promise<string>>());

vi.mock("@norish/api/parser/fetch", () => ({ fetchRenderedPage: renderPage }));

const A_REAL_PAGE = `<html><head><title>Zoekresultaten</title></head><body>${"x".repeat(30_000)}</body></html>`;
const A_CHALLENGE = "<html><body>checking your browser</body></html>";
const RENDERED = `<html><head><title>Rendered</title></head><body>${"y".repeat(30_000)}</body></html>`;

function answerWith(body: string, status = 200) {
  return vi.fn(async () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: async () => Promise.resolve(body),
    })
  );
}

describe("fetchStorePage", () => {
  beforeEach(() => {
    renderPage.mockReset();
    renderPage.mockResolvedValue(RENDERED);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes what a plain fetch answers and renders nothing", async () => {
    vi.stubGlobal("fetch", answerWith(A_REAL_PAGE));

    const visit = await fetchStorePage("https://www.dirk.nl/zoeken/producten/kaas");

    expect(visit).toMatchObject({ html: A_REAL_PAGE, rendered: false });
    expect(renderPage).not.toHaveBeenCalled();
  });

  it("escalates to Obscura when the shop turns the fetch away", async () => {
    vi.stubGlobal("fetch", answerWith("", 403));

    const visit = await fetchStorePage("https://www.ah.nl/zoeken?query=kaas");

    expect(visit).toMatchObject({ html: RENDERED, rendered: true });
  });

  it("escalates to Obscura when the answer is a challenge rather than a shop", async () => {
    vi.stubGlobal("fetch", answerWith(A_CHALLENGE));

    const visit = await fetchStorePage("https://www.ah.nl/zoeken?query=kaas");

    expect(visit).toMatchObject({ html: RENDERED, rendered: true });
  });

  it("escalates to Obscura when the caller found nothing on the page", async () => {
    vi.stubGlobal("fetch", answerWith(A_REAL_PAGE));

    const visit = await fetchStorePage("https://www.ah.nl/zoeken?query=kaas", () => true);

    expect(visit).toMatchObject({ html: RENDERED, rendered: true });
  });

  it("does not escalate for an error the shop states plainly", async () => {
    vi.stubGlobal("fetch", answerWith("not found", 404));

    const visit = await fetchStorePage("https://www.dirk.nl/zoeken/producten/kaas");

    expect(visit).toMatchObject({ html: "", rendered: false });
    expect(renderPage).not.toHaveBeenCalled();
  });

  it("fails without throwing when Obscura cannot render either", async () => {
    vi.stubGlobal("fetch", answerWith("", 403));
    renderPage.mockResolvedValue("");

    await expect(fetchStorePage("https://www.ah.nl/zoeken?query=kaas")).resolves.toMatchObject({
      html: "",
      rendered: false,
    });
  });

  it("hands back the address the shop answered from, for the page to be read against", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          status: 200,
          url: "https://www.dirk.nl/zoeken/producten/kaas",
          text: async () => Promise.resolve(A_REAL_PAGE),
        })
      )
    );
    const readAgainst: string[] = [];

    const visit = await fetchStorePage("https://dirk.nl/zoeken/producten/kaas", (_html, at) => {
      readAgainst.push(at);

      return false;
    });

    // A shop that redirects to its `www.` writes its links for that host.
    expect(visit.url).toBe("https://www.dirk.nl/zoeken/producten/kaas");
    expect(readAgainst).toEqual(["https://www.dirk.nl/zoeken/producten/kaas"]);
  });

  it("waits, when rendering, for the shelf to be drawn and not only for the challenge to pass", async () => {
    vi.stubGlobal("fetch", answerWith("", 403));
    let settled: ((html: string) => boolean) | undefined;

    renderPage.mockImplementation(
      async (_url: string, _tokens?: unknown, isSettled?: (html: string) => boolean) => {
        settled = isSettled;

        return Promise.resolve(RENDERED);
      }
    );

    await fetchStorePage("https://www.ah.nl/zoeken?query=kaas", (html) => !html.includes("shelf"));

    // A real page with nothing on it yet is not settled; one with the shelf is.
    expect(settled?.(A_REAL_PAGE)).toBe(false);
    expect(settled?.(A_REAL_PAGE.replace("<body>", "<body>shelf"))).toBe(true);
    expect(settled?.(A_CHALLENGE)).toBe(false);
  });

  it("still reads a plain-fetchable shop when Obscura is out of reach", async () => {
    vi.stubGlobal("fetch", answerWith(A_REAL_PAGE));
    renderPage.mockRejectedValue(new Error("Obscura is not reachable"));

    await expect(
      fetchStorePage("https://www.dirk.nl/zoeken/producten/kaas")
    ).resolves.toMatchObject({ html: A_REAL_PAGE, rendered: false });
  });
});
