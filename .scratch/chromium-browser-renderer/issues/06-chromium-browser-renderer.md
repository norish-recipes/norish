# 06: The Chromium browser renderer, without tokens

**What to build:** An administrator switches on a **Chromium browser**, any Chromium with a CDP endpoint, in the Page Renderers card, and enters its endpoint. Imports, Store Visits and the Instagram caption fallback then reach it after Obscura and before the solver. Each renderer stays optional. With Allow private addresses off, a main-document hop to a private address is refused inside the browser. Site Auth Tokens are not sent to it yet; that is ticket 07. Spec: `.scratch/chromium-browser-renderer/spec.md`.

**Blocked by:** 01, 03, 05.

**Status:** done

**Setting**
- [x] The Page Renderers setting has `chromium: { enabled, endpoint }`, with a schema default of off and empty, and the "endpoint required when enabled" refinement.
- [x] A stored 0.26 beta row without the key backfills and still parses, rather than falling back to env.
- [x] `CHROMIUM_BROWSER_ENDPOINT` seeds it on first boot and enables it. Admin settings own it afterwards.
- [x] The admin read and save pair carry the setting, and a non-admin is refused.
- [x] The card shows a "Chromium browser" switch, described as "Any Chromium with a CDP endpoint", and an endpoint field, with i18n keys in every locale.

**The chain**
- [x] The chain runs Obscura, then the Chromium browser, then the solver, each skipped when off. Each renderer runs alone, and so does each pair.
- [x] The private-address check runs once and is reused for the Chromium browser and the solver.
- [x] The answered-renderer log names `chromium`.
- [x] The Chromium browser gets the "is settled" reading, so Store Visits settle there too.
- [x] Inside the Chromium browser, document requests are intercepted. A main-document hop to a private address fails the render when Allow private addresses is off, and is allowed when it is on.

**Docs and tests**
- [x] The real-browser E2E: the E2E runner's own Chromium is started with a DevTools port and set as the endpoint, with Obscura off, and an import of a fixture recipe page succeeds through it.
- [x] The card's E2E covers switching it on, saving the endpoint, and seeing it kept after a reload.
- [x] ADR-0019 is edited in place:
  - three renderers in a fixed order, and three named calls;
  - Camoufox recorded as a considered option, rejected for its Playwright-protocol version lockstep and its missing runtime image;
  - CloakBrowser and Fortress recorded as rejected, licence-gated;
  - the Chromium browser's private-address limits (subresources and DNS rebinding are not checked).
- [x] `.env.example`, the configuration page and the Upgrade notes gain `CHROMIUM_BROWSER_ENDPOINT`. The 0.26.0 release notes get a feature line.
