# Domain Docs

How the engineering skills should consume and maintain this repo's domain documentation.

This repo is **single-context**: one product, one ubiquitous language ("Warm Set", "Replay", "Household" mean the same thing in every app and package). The glossary is one root `CONTEXT.md`, grouped by feature area. Decisions live in `docs/adr/`, foldered by feature area.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the glossary, with a `###` subsection per feature area (e.g. Connectivity & Offline).
- **`docs/adr/<area>/`** — read the ADRs for the areas you're about to work in.

If a term or ADR you need doesn't exist, **proceed silently**. Don't flag absences; the `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates entries lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md                  ← one glossary, ### section per feature area
├── docs/adr/
│   ├── index.html              ← human-facing decision summary (links by relative path — update it if files move)
│   ├── offline/
│   │   ├── 0001-web-offline-is-a-persisted-query-cache.md
│   │   └── … 0002–0009
│   ├── releases/
│   │   └── 0010-release-notes-use-a-release-checkpoint.md
│   └── …                   ← other feature areas
├── apps/
└── packages/
```

## ADR rules

- **ADRs state the current decision.** When a later decision changes one, rewrite the earlier ADR in place. Don't add supersession notes, dated amendments, or struck-out history. Git keeps the history.
- **Delete an ADR only when none of its decision still stands.** Repoint every citation of its number, including code comments, docs, and `docs/adr/index.html`, to the ADR that replaced it.
- **Numbering is global and immutable.** `ADR-NNNN` ids are unique across all area folders and code cites them (`rg "ADR-0037"`). Never renumber or reuse one; a deleted ADR leaves a gap. To pick the next number, scan **all** of `docs/adr/**` for the highest and add one.
- **Keep the index current.** `docs/adr/index.html` summarises each ADR as it now reads. Update its entry whenever an ADR is rewritten or deleted.
- **Folders are feature areas**, in kebab-case: `ai/`, `cookbooks/`, `groceries/`, `households/`, `imports/`, `offline/`, `realtime/`, `recipes/`, `releases/`, and `ui/`. Create an area folder lazily with its first ADR. File an ADR in the area it most belongs to. Its id stays findable regardless of folder.
- **Locate an ADR by number, not path**: glob `docs/adr/**/NNNN-*.md`.

## Growth path

If a feature area ever develops a genuinely separate language (the same word meaning different things in two areas), split to a `CONTEXT-MAP.md` multi-context layout then — not before. Until that day there is one glossary.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids (e.g. "Offline"/"Live", not "disconnected"/"online").

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0004 (first-writer-wins on replay conflicts) — but worth reopening because…_

If the decision changes, rewrite the older ADR to reflect it.

## Retired: openspec

`openspec/` (capability specs + change proposals) was removed in July 2026. Don't look for it, and don't recreate spec mirrors of current behavior — behavior truth is the code and its tests; language lives in `CONTEXT.md`; decisions in `docs/adr/`; work-in-progress in `.scratch/` tickets (see `issue-tracker.md`).
