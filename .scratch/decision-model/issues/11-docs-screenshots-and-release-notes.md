# 11 — Docs, screenshots and release notes

Status: ready-for-agent
Blocked by: 03, 04, 05, 06, 07, 08, 09, 10

Spec: `.scratch/decision-model/spec.md`
Convention: `docs/agents/feature-docs.md`

## What to build

- `apps/docs/docs/configuration/ai-provider.md` gains a **Decision Model** section after Image Generation: what it is in one paragraph (a second, optional provider that answers closed questions and generates nothing), the settings table (Provider, API Key, Model, Endpoint), where a key comes from, what it speeds up (auto-categorization, allergy detection, import triage, provenance, product suggestions) and what it checks (the verification pass, ticket 10), and what it cannot do (extraction, nutrition, notes, unit conversion, images). A screenshot of the block at `apps/docs/static/img/screenshots/admin-decision-model.png`.
- The same page's Recipe Enrichment table gains a column or note saying which kinds ask a Decision first and that they fall back to the AI provider.
- `apps/docs/docs/recipes/enrichment.md` (or wherever the kinds are described for cooks) says, in one sentence, that nothing on the recipe changes depending on which model decided, and that a verification pass may drop a tag, Cuisine or Step Ingredient the model was not sure of.
- `apps/docs/docs/groceries/prices.md` (or the page that describes the grocery panel's offered products) says the list is ordered by the Decision Model when one is configured and that nothing is linked without the shopper.
- The Target Version's release notes (`apps/docs/docs/release-notes/<target>.md`, checkpoint first if 0.23.1 is still the editable label) get a `### Decision Model` under Features written for self-hosters: optional, own key, cheaper and faster categorisation and allergy tagging, imports refused faster when a page is not a recipe. An Upgrade note **only** if ticket 01 changed anything a self-hoster configures.
- `CONTEXT.md` and ADR-0035 (ticket 02) are re-read against what shipped and corrected where they drifted.

## Acceptance criteria

- [ ] The configuration page, the enrichment page and the release notes are updated with the glossary's vocabulary.
- [ ] The screenshot exists and is embedded.
- [ ] `pnpm format` and `pnpm build` pass in `apps/docs`.
- [ ] The glossary and ADR match the shipped behaviour.

## Comments

- Filed 2026-09-19 with the spec.
