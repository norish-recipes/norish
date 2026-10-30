# 02 Clean up catalogue button

Status: ready-for-agent
Blocked by: 01

Spec: Solution 4

## What

- In the Ingredient catalogue section, a **Clean up catalogue** button opens a dialog: scope **Recipe foods** / **Whole catalogue**, the count of foods it will ask about, Confirm. Admin-only tRPC procedures (count + start). Disabled while a run is active or AI is off.
- Recipe foods = today's `askableByAI()` set. Whole catalogue = every listed food including seeded, ignoring `keptDistinct`, `nameChosen`, `parentChosen` and remembered undos for that run only (the markers are not cleared). Seeded foods: the spelling check (today's `checkSpellings` job) plus a merge or a parent; never deleted, and an AI answer of not-a-food on a seeded food is dropped.
- One job on the existing review queue, visible and cancellable in the Job queue.

## Acceptance

- Both scopes' food sets tested, including that a whole run asks about a person-parented food and a food with an undone change, and never deletes a seeded food.
- Running recipe foods after ticket 01 gives the same changes the old boot pass gave.
- E2E (`ai` project): a recipe-foods run from the admin section changes a food and lists it under Changed by AI.

## Comments

- 2026-10-24, implemented in f2d056062. Differences: the run option is an AsyncLocalStorage scope (`overridingDecisions` in `ai-changes.ts`) that the worker opens for a whole-catalogue run, read where the markers and undos are checked, rather than a parameter threaded through every AI Change. A whole run also gives a person-named or undone-rename food its Plain Name again (the settled name is overridden, `renameToPlainName({ evenSettled })`). On a seeded food a split or not-a-food answer is skipped (`reason: "seeded"`), it gets no Plain Name, and AI's "no parent" does not drop its parent. A Clean up run (job name `clean-up`) draws no icons, which is Fill gaps' work; otherwise recipe foods is the old boot pass. The unused `addSpellingCheckJob`, `check: "spellings"` and `listSeededFoodsWithOwnSpellings` went: `checkSpellingsOf` skips a seeded food with no added spellings without asking. The spelling-check prompt's description now says it runs in a whole-catalogue Clean up.
