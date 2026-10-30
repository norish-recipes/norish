# 07: Site Auth Tokens through the Chromium browser

**What to build:** A household member's Site Auth Tokens reach the Chromium browser, kept to their site.

- **Headers** are added through CDP `Fetch` interception, with request patterns limited to the token's https domain and its subdomains. Each paused hop continues with the header tokens whose domain it is on, so a redirect off the site carries nothing. Playwright's `route` is not used, because its header overrides follow redirects.
- **Cookies** are set with the context's `addCookies`, `secure` and for the token's domain, before navigating.

The solver still never gets tokens. Spec: `.scratch/chromium-browser-renderer/spec.md` (Tokens).

**Blocked by:** 02, 06.

**Status:** done

- [x] At the rendered-page entry point, the faked Chromium session continues requests to the token's https site with the header, and other hosts' requests are never paused.
- [x] Cookie tokens are set through `addCookies` with their domain and `secure`, with no robots.txt pre-navigation.
- [x] An http target gets no tokens, as ticket 03 already holds for Obscura.
- [x] When the chain reaches the solver, it still gets no tokens, and the withheld-tokens log fires.
- [x] The real-browser E2E: a fixture is served on two distinct hostnames. An import with a header token for the first shows the header arriving there, and an off-site redirect to the second without it.
- [x] ADR-0019's token rule reads "the solver never gets tokens", replacing "only Obscura carries tokens", title included.
- [x] The Page Renderers card's token description no longer says Site Auth Tokens need Obscura.
