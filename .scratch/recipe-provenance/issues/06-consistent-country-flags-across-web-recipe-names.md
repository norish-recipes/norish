# 06 — Consistent country flags across web recipe names

**What to build:** Present a known Recipe Provenance country consistently wherever the web app displays the recipe's primary name. The flag is a derived visual prefix only; it does not contaminate recipe data, editing, lookup, links, exports, or native mobile presentation.

**Blocked by:** 02 — Paste import to rendered provenance

**Status:** ready-for-agent

- [ ] A shared web presentation rule derives a flag only from a validated ISO 3166-1 alpha-2 code and prefixes it before the unchanged recipe name.
- [ ] Recipe detail, recipe cards and lists, and public shared-recipe pages use the same presentation rule whenever origin is available.
- [ ] A `null` or invalid origin renders the original name with no flag, placeholder, or broken glyph.
- [ ] Editable name fields, persisted names, search text and matching, URLs, exports, timers, groceries, and other secondary recipe-name references remain undecorated.
- [ ] Native mobile UI remains unchanged while shared recipe contracts remain compatible with future mobile provenance support.
- [ ] The visual flag is hidden from assistive technology because the provenance panel exposes the localized country name; title semantics and keyboard behavior remain accessible.
- [ ] Production-like browser E2E covers a known country on detail, a card or list, and a public share, plus an uncertain `null` country and an unchanged edit form value.
- [ ] Presentation helper, affected component, shared-page, accessibility, and focused browser tests for this slice pass.
