# 02 — Cut rendered URL imports over to Obscura

**What to build:** Replace the Chrome- and Rebrowser-specific rendered-page path with the single Obscura boundary used by recipe imports and every existing rendered-page consumer.

**Blocked by:** 01 — Publish the Norish Obscura image

**Status:** ready-for-agent

- [ ] The server uses official `playwright-core`, aligned to the repository's Playwright Test major and minor version, with the Rebrowser alias and packages removed from dependency metadata.
- [ ] `OBSCURA_ENDPOINT` is the sole rendered-page endpoint setting; `CHROME_WS_ENDPOINT` is removed without an alias or deprecation path.
- [ ] Norish connects directly to the configured Obscura endpoint through Playwright's CDP connection contract without Chrome debugger discovery, DNS lookup, or endpoint-host rewriting.
- [ ] The shared connection is reused while connected and replaced on the next request after Obscura disconnects.
- [ ] Every rendered-page fetch creates a fresh isolated browser context and page, injects only the requesting user's Site Auth Token headers and scoped cookies, returns the rendered HTML, and closes its context after success or failure.
- [ ] Navigation occurs once under one bounded deadline; Chrome-specific challenge detection, recipe-selector races, additional idle waits, arbitrary sleeps, and undocumented HTTP or browser fallback paths are absent.
- [ ] Norish no longer supplies a fabricated browser identity, including generic user-agent, Chrome client hints, fetch metadata, language, cache, DNT, referer, viewport, or similar anti-detection values.
- [ ] Structured parsing, forced AI extraction, AI fallback, non-recipe failure, and video-import consumers retain their current observable outcomes while using the same rendered-page seam.
- [ ] Missing or unreachable Obscura remains an import-time operational failure rather than preventing the Norish server from starting.
- [ ] Existing focused unit seams prove Norish-owned endpoint, isolation, Site Auth Token, rendered-HTML, reconnection, error, and cleanup behavior without testing Obscura internals.
