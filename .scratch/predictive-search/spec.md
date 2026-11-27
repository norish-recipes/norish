# Predictive search

Status: ready-for-agent

Settled in a `/grill-with-docs` session on 2026-11-25.

- **Vocabulary:** CONTEXT.md's **Completion** (Library & Cookbooks) and **Archived Grocery** (Groceries & Stores).
- **Decisions:** no ADR; archiving is easy to reverse and the glossary explains it.
- **Target Version:** 0.28.0-beta.
- **Tickets:** in `issues/`. Mobile is in scope throughout.
- **Order:** groceries work waits for `.scratch/household-boundary/issues/02-household-things-belong-to-the-household.md`, which moves groceries onto `household_id`. UI tickets wait for the canvas (ticket 01).

## Problem Statement

Typing a recipe search or a grocery name means typing every letter, even for the name the household writes every week. "Delete done" also throws away the only record of what the household buys, so nothing can offer it back.

## Solution

While typing, Norish offers up to three Completions. Choosing one fills the field and does nothing else.

- **Where:** web Library search, mobile Search, the web add-grocery panel and the mobile add-groceries sheet. Pickers (ingredient picker, store-product ComboBox, cookbook pickers, mini-recipes, admin model picker) are out of scope.
- **Web:** the best Completion that continues the typed text shows as ghost text after it; Tab or → at the end of the text accepts it. Up to three Completions show as plain buttons after the field.
- **Mobile:** no ghost text. Search's typing-suggestion rows each get a ↖ fill arrow; the add-groceries sheet gets a row of up to three chips under the name field.
- **Groceries:** clearing done groceries archives them instead of deleting them. Archived Groceries are where grocery Completions come from.

## Decisions

### Archived Groceries

- **Clearing done archives.** The per-store and per-recipe-section "Delete done" actions archive the done groceries they clear. Labels in the app stay as they are; the user is not told.
- **Deleting deletes.** Deleting one grocery, and Delete in selection mode, stay hard deletes. That is also how a typo is forgotten; otherwise it ages out.
- **No archive UI.** Nobody sees, browses or restores an Archived Grocery.
- **Retention stays per row.** The nightly cleanup (`packages/queue/src/scheduler/old-groceries-cleanup.ts`) keeps deleting done, non-recurring rows older than `SCHEDULER_CLEANUP_MONTHS`, archived or not. No new setting.
- **No "hit" tracking.** Every add is a row of its own, so a name lives as long as its newest row. Accepting a Completion is an ordinary add.
- **Archived rows are off the list everywhere:** the list read, pricing (`packages/trpc/src/routers/stores/pricing.ts` reads done rows today) and realtime, which tells other members they left exactly as a delete does today.

### Matching (`packages/shared`)

One pure function, used by every field. Matching ignores case.

1. **Word start:** one of the candidate's words starts with the whole typed text ("tikka m" and "masala" both find "Chicken tikka masala"). Only this tier can be ghost text.
2. **One slip:** a word's start is one slip from the typed text, from 5 typed letters up, never the first letter ("chikcen" finds "chicken"). Reuse the slip rule in `packages/shared/src/lib/name-slips.ts`.
3. **Inside a word:** the typed text sits inside a word, from 3 typed letters up ("ikka" finds "Tikka").

- The top three across the tiers are offered, higher tiers first.
- **Ghost text** is the best tier-1 Completion. Where one tier-1 candidate continues another ("tikka", "tikka masala"), the shorter one is the ghost text; the longer stays in the list. Otherwise the order below decides.
- **What fills:** the typed characters keep the typed casing; the rest comes from the candidate from the matched word on ("tik" → "tikka masala").
- **Stale answers never show:** a Completion shows only while it still matches what is in the field now.

### Candidates and order

- **Recipe search:** top-result titles first, then ingredient, tag and category names. It uses the reads search already makes (`useLibraryList`, `library.suggest`); offline there are none, as mobile typing suggestions today. An ingredient or tag Completion fills text, never a filter chip, and the search runs as if typed.
- **Groceries:** every grocery the household still keeps, however it was added (typed, from a recipe, recurring), except names still open on the list. Most often added first, then most recently added; where the same folded name has several spellings, the newest is shown. A recurring grocery is one row, so it counts once.
- **Amount stays:** `useParsedGroceryName` strips the typed amount, so "2 mi" completes the name to "2 milk". Only the name fills; the old row's amount, unit and store are not copied. The Store comes from the store preference as on any add.

### Keyboard (web)

- Tab or → at the end of the text accepts the ghost text. Tab without ghost text moves focus as usual, into the Completion buttons.
- Enter submits exactly what was typed, never the ghost text.
- The Completions are plain buttons in tab order. No arrow-key list.

### Design and accessibility

A new claude.ai Design canvas (ticket 01) settles the look of all four fields and their accessibility before any UI is built. Starting point: ghost text hidden from screen readers, Completions as labelled buttons, no live announcement.

## Out of scope

- Completions on an empty field ("usual groceries").
- Pickers and any other field.
- Any UI for Archived Groceries, and a "forget this Completion" action.
- Fuzzy matching beyond one slip.
