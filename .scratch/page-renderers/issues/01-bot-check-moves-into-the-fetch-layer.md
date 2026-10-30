# 01: The bot check moves into the fetch layer

**What to build:** A prefactor for the Page Renderer chain. The fetch layer gets one shared bot-check reading of returned HTML, and the Store Visit module uses it in place of its own copy. Store Visits behave exactly as before: a small title-less stub is still a bot check. The reading also learns Cloudflare's challenge markup ("Just a moment…" / `cf-challenge`), which the chain in ticket 03 needs to tell that Obscura was challenged. See `.scratch/page-renderers/spec.md` and ADR-0019.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The fetch layer owns one bot-check function, and the Store Visit module no longer defines its own
- [ ] It returns true for the small title-less stub Store Visits already detect and for Cloudflare challenge pages, and false for a real recipe page and a real shop page
- [ ] Store Visit escalation and settling behave as before, and the existing Store Visit tests pass unchanged apart from imports
- [ ] Unit tests cover the bot-check reading directly, with Cloudflare challenge fixtures
