# 01: The bot check reads titled block pages and refusal statuses

**What to build:** A page that a Page Renderer gets back as a block page with a title is a bot check, so the chain moves on to the next renderer instead of stopping. Today, Akamai's "Access Denied" page has a `<title>`, so Obscura's answer for Allerhande stops the chain and the solver is never tried. After this ticket a blocked Obscura hands the page on. Spec: `.scratch/chromium-browser-renderer/spec.md` (The bot check).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A page under the existing stub size whose title is "Access Denied", "Attention Required!" or "403 Forbidden" is a bot check.
- [x] A rendered page whose main-document status is 401, 403 or 429 is a bot check.
- [x] Cloudflare's 403-then-200 handoff still reads as the real page, because only the main frame's last navigation counts.
- [x] A real recipe page with one of those words somewhere in its body is not a bot check.
- [x] The plain fetch is unchanged.
- [x] At the rendered-page entry point, Obscura answering with Akamai's block page (status 200) falls through to the solver. The test fails before the fix.
- [x] It is one shared bot-check test, still owned by the fetch layer.
