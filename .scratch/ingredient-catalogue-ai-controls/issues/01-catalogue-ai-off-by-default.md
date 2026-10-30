# 01 Catalogue AI is off by default, under one multi-select

Status: ready-for-agent

Spec: `.scratch/ingredient-catalogue-ai-controls/spec.md` (Solution 1, 2, 3)

## What

- `AutomaticIngredientsSchema` becomes `{ cleanUp, nutrition, conversions, icon }`, all `false` by default. A stored old shape parses to the defaults plus its `icon`.
- Admin → AI processing gets an **Ingredient catalogue** accordion item with the **Automatic for new ingredients** multi-select (same pattern as Automatic enrichment). "Draw missing icons" only shows when `canDrawImages`. The old "Automatic ingredients" switch in `ai-config-form.tsx` goes. `nutrition` and `conversions` are stored and shown now; ticket 04 makes them do something.
- The mint hook (`onIngredientsMinted` → `addIngredientReviewJob`) only queues when `cleanUp` is on. With `cleanUp` off and `icon` on, the icon job is queued straight after the mint.
- Boot: the first-start cleanup's AI step (`listAskableIngredientIds` → `addIngredientReviewJob`) and `checkSpellingsOnBoot` go. The nightly `ingredient-sweep` scheduled task goes.
- A minted food is no longer flagged `ai-queued` / `ai-off`, and a failed answer (`ai-unavailable`, `ai-key-rejected`) no longer flags it. Remove those reasons and `RETRIED_FLAG_REASONS`. Flags with those reasons are cleared at first start (bump the cleanup version, or a step in it).
- Amend ADR-0037 (2026-10-23 entry) for the reversals named in the spec's Decisions.

## Acceptance

- With AI on and nothing selected, minting a food queues no AI job, and booting queues none.
- Selecting Clean up new ingredients restores today's mint behaviour.
- No food carries one of the removed flag reasons after first start.
- Tests for the gating and the config parsing; existing tests that relied on boot/nightly/flagging updated.

## Comments

- 2026-10-23, implemented in cfe86e2b4 (ADR-0037 amendment in a0ba9d247). The `ingredient-sweep` task stays for its deterministic work (unused foods, month-old AI Changes); only its AI retry went. Retired flags are lifted by a new first-start step 8 (`CLEANUP_VERSION` 5), which keeps `ai-unsure` on a food whose unsure change is still open. A pass with no answer now reports `unanswered` rather than `unsure`. `spellingCheckVersion` left the seed state with the boot check. `listAskableIngredientIds` and `listSeededFoodsWithOwnSpellings` are kept, unused, for ticket 02. The ingredient-catalogue E2E turns Clean up on for its run. Open: the boot recheck of undecided mints (`listUndecidedMints`) still picks only flagged foods, so a mint made from now on, unflagged, is not rechecked when the resolver's rules change.
- 2026-10-24, follow-up in ba54f8e54 (Mike: recheck every own food no person decided about): `listUndecidedMints`, `adoptPlainName` and `fileUndecidedMint` no longer require the flag, so an unflagged mint is rechecked at the next `RUNG_VERSION`; kept distinct, chosen parents and settled names stay untouched. No version bump: every release recorded `RUNG_VERSION` 6 or lower, so each instance rechecks once under 10 with the new selection.
