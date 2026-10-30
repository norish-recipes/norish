// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { isBotCheck } from "@norish/api/parser/fetch";

vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const padding = "x".repeat(30_000);

/** Cloudflare's managed challenge, trimmed to the markup that names it. */
const CLOUDFLARE_CHALLENGE = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title>
<meta http-equiv="refresh" content="390"></head><body><div class="main-wrapper" role="main">
<noscript><div class="h2"><span id="challenge-error-text">Enable JavaScript and cookies to continue</span></div></noscript>
</div><script>(function(){window._cf_chl_opt={cvId: '3',cZone: "www.example.com",cType: 'managed'};})();</script>
${padding}</body></html>`;
/** The older interstitial, which names itself in a class rather than its title. */
const CLOUDFLARE_INTERSTITIAL = `<html><head><title>Attention Required! | Cloudflare</title></head>
<body><div class="cf-challenge-running">Checking your browser before accessing example.com.</div>${padding}</body></html>`;
const UNICODE_TITLE = `<html><head><title>Just a moment…</title></head><body>${padding}</body></html>`;
const STUB = "<html><body>checking your browser</body></html>";
const RECIPE_PAGE = `<html><head><title>Lasagne | Example Kitchen</title>
<script type="application/ld+json">{"@type":"Recipe","name":"Lasagne"}</script></head><body>${padding}</body></html>`;
const SHOP_PAGE = `<html><head><title>Zoekresultaten kaas | Dirk</title></head><body><ul class="products">${padding}</ul></body></html>`;
/** Akamai's block page, as Allerhande answered Obscura with a 200 on 2026-10-25. */
const AKAMAI_BLOCK = `<HTML><HEAD>
<TITLE>Access Denied</TITLE>
</HEAD><BODY>
<H1>Access Denied</H1>
You don't have permission to access "http&#58;&#47;&#47;www&#46;ah&#46;nl&#47;allerhande&#47;recept&#47;R&#45;R1199735" on this server.<P>
Reference&#32;&#35;18&#46;5e3c1302&#46;1761400000&#46;1a2b3c4d
</BODY>
</HTML>`;
const NGINX_FORBIDDEN = `<html>
<head><title>403 Forbidden</title></head>
<body><center><h1>403 Forbidden</h1></center><hr><center>nginx</center></body>
</html>`;
const CLOUDFLARE_BLOCKED = `<html><head><title>Attention Required! | Cloudflare</title></head>
<body><h1>Sorry, you have been blocked</h1></body></html>`;

describe("isBotCheck", () => {
  it("reads Cloudflare's challenge pages as a bot check", () => {
    expect(isBotCheck(CLOUDFLARE_CHALLENGE)).toBe(true);
    expect(isBotCheck(CLOUDFLARE_INTERSTITIAL)).toBe(true);
    expect(isBotCheck(UNICODE_TITLE)).toBe(true);
  });

  it("reads a small page with no title of its own as a bot check", () => {
    expect(isBotCheck(STUB)).toBe(true);
    expect(isBotCheck("<html><head><title> </title></head></html>")).toBe(true);
  });

  it("reads a small block page titled as one as a bot check", () => {
    expect(isBotCheck(AKAMAI_BLOCK)).toBe(true);
    expect(isBotCheck(NGINX_FORBIDDEN)).toBe(true);
    expect(isBotCheck(CLOUDFLARE_BLOCKED)).toBe(true);
    expect(isBotCheck("<html><head><title>access denied</title></head></html>")).toBe(true);
  });

  it("reads a page a renderer was refused with as a bot check, whatever it holds", () => {
    for (const status of [401, 403, 429]) {
      expect(isBotCheck(RECIPE_PAGE, status), String(status)).toBe(true);
    }
    expect(isBotCheck(RECIPE_PAGE, 200)).toBe(false);
    expect(isBotCheck(RECIPE_PAGE, null)).toBe(false);
  });

  it("reads a page that only mentions a block in its body as itself", () => {
    expect(
      isBotCheck(
        "<html><head><title>Kaas</title></head><body><h1>Access Denied</h1> 403 Forbidden</body></html>"
      )
    ).toBe(false);
    expect(
      isBotCheck("<html><head><title>Access Denied Cocktail | Bar</title></head></html>")
    ).toBe(false);
  });

  it("reads a real recipe page and a real shop page as themselves", () => {
    expect(isBotCheck(RECIPE_PAGE)).toBe(false);
    expect(isBotCheck(SHOP_PAGE)).toBe(false);
    expect(isBotCheck("<html><head><title>Kaas</title></head><body>small</body></html>")).toBe(
      false
    );
  });
});
