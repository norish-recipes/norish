# 02 — Paste import to rendered provenance

**What to build:** Deliver the first complete Recipe Provenance tracer bullet. With automatic provenance enabled, a successful paste import remains responsive, queues inference, persists a validated result, exposes authoritative progress, refreshes through the existing recipe realtime channel, and renders the final provenance on recipe detail. A known country prefixes the displayed recipe name with its derived flag without changing the stored name.

**Blocked by:** 01 — Production-like AI E2E harness

**Status:** ready-for-agent

- [ ] Recipes can persist one nullable ISO 3166-1 alpha-2 origin country code, an optional region or sub-region, normalized cuisine labels, and a nullable explanatory note without fabricating values for existing recipes.
- [ ] The default inference prompt requests exactly one primary country code or `null`, supports known multinational dishes through one primary country plus explanation, and uses no editable or duplicated country list.
- [ ] Inference output is structurally validated, trimmed, bounded, and deduplicated before one atomic repository save; invalid or empty output cannot partially update a recipe.
- [ ] A dedicated operation-aware provenance queue participates in normal registry lifecycle, configured retention, worker startup and shutdown, job steps, and the existing job monitor.
- [ ] A successful paste import queues at most one deterministic provenance job without waiting for inference or rolling back the imported recipe if queueing fails.
- [ ] Queue work uses the registered AI-handler boundary, loads current recipe content through repositories, and does not copy the recipe document into job data or introduce a package dependency cycle.
- [ ] Recipe detail shows a localized provenance-only pending state, remains otherwise usable, and refreshes the authoritative status and recipe data after a typed realtime success event.
- [ ] The completed provenance panel presents the localized country name, optional region, cuisine labels, explanatory note, and clear AI-inferred framing.
- [ ] A validated country prefixes the recipe-detail display name while the persisted and editable name remains unchanged; `null` renders no flag.
- [ ] The production-like browser E2E begins with paste import and proves queueing, pending UI, persistence, realtime refresh, final provenance, and the country-prefixed unchanged title using only the controlled AI-provider response.
- [ ] Repository, worker, API, subscription, component, locale, and focused browser tests for this slice pass.
