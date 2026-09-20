# 11 — Docs, screenshots and release notes

Status: ready-for-human
Blocked by: 03, 04, 05, 06, 07, 08, 09, 10

Spec: `.scratch/decision-model/spec.md`
Convention: `docs/agents/feature-docs.md`

## What to build

- `apps/docs/docs/configuration/ai-provider.md` gains a **Decision Model** section after Image Generation: what it is in one paragraph (a second, optional provider that answers closed questions and generates nothing), the settings table (Provider, API Key, Model, Endpoint) and the **Use the Decision Model for** multi-select (what each entry governs, that all are selected by default, that import triage is not in the list), where a key comes from, what it speeds up (auto-categorization, allergy detection, import triage, provenance, product suggestions) and what it checks (every enrichment run validates its own output, ticket 10, and why stored data is never touched), and what it cannot do (extraction, nutrition, notes, unit conversion, images). A screenshot of the block at `apps/docs/static/img/screenshots/admin-decision-model.png`.
- The same page's Recipe Enrichment table gains a column or note saying which kinds ask a Decision first and that they fall back to the AI provider.
- `apps/docs/docs/recipes/enrichment.md` (or wherever the kinds are described for cooks) says, in one sentence, that nothing on the recipe changes depending on which model decided, and that a run's own tags, categories, Cuisines and Step Ingredients are checked before they are written while anything a person entered is never touched.
- **A mermaid diagram of how it works internally**, on the AI provider page under the Decision Model section: the AI Runtime with its four entry points, a feature's two branches (Decision first, clear case acted on, otherwise the language model or heuristic), and the validation step between the language-model answer and the write. Docusaurus does not render mermaid out of the box: add `@docusaurus/theme-mermaid` to `apps/docs`, set `markdown.mermaid: true` and register the theme in `docusaurus.config.ts`, and confirm `pnpm build` still throws on broken links. A second, smaller diagram on the grocery pricing page shows the lookup ladder: unmistakable name, then the Decision (link above the threshold, otherwise order and suggest), then the Miss.
- `apps/docs/docs/groceries/prices.md` (or the page that describes the grocery panel's offered products) says a Decision Model may link a product it is sure of, that the offered list is ordered by it otherwise, and that unlinking works as before.
- The Target Version's release notes (`apps/docs/docs/release-notes/<target>.md`, checkpoint first if 0.23.1 is still the editable label) get a `### Decision Model` under Features written for self-hosters: optional, own key, cheaper and faster categorisation and allergy tagging, imports refused faster when a page is not a recipe. An Upgrade note **only** if ticket 01 changed anything a self-hoster configures.
- `CONTEXT.md` and ADR-0035 (ticket 02) are re-read against what shipped and corrected where they drifted.

## Acceptance criteria

- [x] The configuration page, the enrichment page and the release notes are updated with the glossary's vocabulary.
- [ ] The screenshot exists and is embedded (needs a running admin form; see Comments); both mermaid diagrams render in the built site (done).
- [x] `pnpm format` and `pnpm build` pass in `apps/docs`.
- [x] The glossary and ADR match the shipped behaviour.

## Comments

- Filed 2026-09-19 with the spec.
- 2026-09-19 — Docs written: `ai-provider.md` gains the Decision Model section (settings table, the uses multi-select, what it speeds up, what it checks and why stored data is untouched, what it cannot do, the mermaid diagram of the runtime's four entry points with the Decision-first branch and the validation step) and a _Asks the Decision Model first_ column on the Recipe Enrichment table; `recipes/enrichment.md` says nothing on the recipe changes by model and a run's own claims are checked while a person's are never touched; `groceries/prices.md` describes the link-or-rank behaviour with the lookup-ladder diagram; `release-notes/0.24.0-beta.md` gains `### Decision Model` under Features (no Upgrade note: the AI SDK move changed nothing a self-hoster configures, and the new column is an ordinary migration). `@docusaurus/theme-mermaid` added, `markdown.mermaid: true`, both diagrams render in the built site. `CONTEXT.md`'s Enrichment Validation entry and ADR-0035's consequences were corrected for the shadow launch modes and the grocery-linking threshold. **Not done: the screenshot** `admin-decision-model.png` — it needs the running admin form, which this environment (no Postgres, no Redis) cannot start; left `ready-for-human` for that one box.
