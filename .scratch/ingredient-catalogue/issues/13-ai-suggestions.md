# 13: AI suggests, a person confirms

**What to build:** Ask AI and Find parent with AI stop editing the catalogue. A sure answer becomes a row in `ingredient_suggestions`: merge into X, a kind of X, or a food of its own (only for a flagged food). There is one row per Ingredient, and asking again replaces it. Many foods may name the same target. A person confirms a suggestion, which makes the edit as their own under the edit policy, or dismisses it, which leaves the food as it was. AI always looks for a parent (what a food is a kind of, never what is a kind of it), and proposes it even when unsure, since a person confirms it anyway.

- **Ingredient panel:** a suggested parent is filled into the draft and marked "Suggested by AI". Save lands it and × dismisses it. A merge or "own food" suggestion is a notice at the top with Confirm and Dismiss. Every other field stays editable.
- **Suggestions panel:** replaces "What AI did". It has per-item Confirm and Dismiss, plus Confirm all and Dismiss all. It opens from the toast that ends a round and from a header button while anything is waiting. The round's foods with no suggestion are listed below with the reason.

**Blocked by:** 06, 07, 09

**Status:** done, pending gates and review

- [x] Migration 0064, repository `ingredient-suggestions`, service `shared-server/ingredients/suggestions.ts`, procedures `suggestions` / `confirmSuggestions` / `dismissSuggestions`.
- [x] Setting a parent or marking distinct by hand settles a pending suggestion; a merge takes it away with the food.
- [x] Unit, DB and component tests; the catalogue E2E round confirms a suggestion.
- [x] Docs page and release notes.

## Comments

- 2026-09-30 follow-up: a round asks `INGREDIENT_REVIEW_CONCURRENCY` (env, default 10) foods at once and announces the changes together at the end; every row shows Asking AI until then. The suggestions drawer opens on its own when the round the viewer started ends, with no toast. Parent test cases for the dev DB: `.scratch/ingredient-catalogue/fixtures/parent-cases.ts`, and `orphan-kinds.ts` (one parent, many kinds: beef's 20). A round whose every food is answered reads as over even while its job winds up, or the refetch after it would show every row asking again.
