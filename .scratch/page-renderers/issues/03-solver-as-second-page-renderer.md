# 03: The FlareSolverr/Byparr solver as the second Page Renderer

**What to build:** An administrator switches on a FlareSolverr-compatible solver and enters its endpoint on the Page Renderers card. A page that Cloudflare challenges in Obscura is then read through the solver.
- Every caller uses the chain without changing: URL import, Store Visits and the Instagram caption fallback.
- The order is fixed. First the plain fetch, as each caller does today. Then Obscura, if it is on. Then the solver, if it is on. The chain moves on only when a renderer returns empty HTML or a bot check, using ticket 01's reading.
- Site Auth Tokens go only to Obscura. The solver gets the page without them, and the log says so.

See `.scratch/page-renderers/spec.md` and ADR-0019.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] A solver client posts `cmd: request.get` with the URL and `maxTimeout` (the shared timeout) to the configured `/v1` endpoint and reads `solution.response`. An error reply, a non-2xx reply, a timeout or an unreachable endpoint all count as empty HTML
- [ ] A solver render always reports a null status, so it never names a refusal, and the caller's "is settled" reading is not applied to it
- [ ] Rendered-page seam tests cover:
  - the chain order and falling through on empty HTML and on a bot check;
  - stopping at Obscura when Obscura returns a real page;
  - each renderer alone and both off;
  - tokens never reaching the solver, and the withheld-tokens log;
  - the null status;
  - which renderer answered being logged
- [ ] The solver switch and endpoint are on the card, with "Site Auth Tokens need Obscura" in the description, and are seeded from `PAGE_SOLVER_ENABLED` and `PAGE_SOLVER_ENDPOINT`, off by default
- [ ] The E2E extends ticket 02's: the solver is switched on with an endpoint, saved, and kept after a reload
- [ ] The Compose example adds commented-out `flaresolverr` and `byparr` services on 8191, each with its matching commented env line, and `.env.example` gains the solver vars
