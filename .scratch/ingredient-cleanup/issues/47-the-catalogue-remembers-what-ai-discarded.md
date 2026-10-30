# 47: The catalogue remembers what was discarded

**What to build:** Mike, 2026-10-22: "can't we make the DB smart by keeping a list of discarded shit, so that in the future we no longer need that AI call", and "the next import of boneless can be thrashed instantly, it's trash not an ingredient". Today a text AI deleted as not a food is minted again by the next recipe that writes it. AI is then asked again and deletes it again. Each time that costs a request and leaves an AI Change.

**Fix: a junk pile.** One table: `fold` (unique), `reason`, `created_at`, and the AI Change id, nullable, for Undo.

- **What goes on it:**
  - AI deletes a food as not a food (`deleteByAI`): the folds of its spellings, which `readDeletedFood` already reads.
  - Ticket 46 removes a spelling as not a food: its fold.
  - A person removes a spelling by hand and says it is not a food (see "Removing a spelling by hand"): its fold, with no change id.
  - The pile seed (below), at boot.
- **Not stored:** a spelling 46 finds names another food, or not this food. Its text is a real food somewhere, so the next line must still find or mint it.
- **What comes off it:**
  - Undo of the AI Change that put it there.
  - A person adding a spelling by hand (`addAliasIn`) whose fold is on the pile. A person who removed a spelling to put it on another food clears it this way.

**The rule, in one place in the resolver (Mike, 2026-10-22).** Where the resolver cuts a text into pieces, a piece whose fold or plain fold is on the pile is dropped. The cuts are the comma cut (`stripPreparation`'s `split(",")[0]`) and the joining words (`spelledParts`). The text is then read on the pieces left. So "boneless, skinless chicken breasts" drops "boneless" and is read as "skinless chicken breasts". Only when every piece is on the pile, as with "boneless" alone, does the text name no food.

- It then follows the Junk Line rule (CONTEXT.md; ticket 13). At import the line is stored as written and names no food. Nothing is minted, no AI is asked, there is no flag, and nothing goes on Changed by AI.
- A typed Grocery or Pantry Ingredient is never junk. It is kept and points at no food, as any text naming none does.
- Make the drop one function, called where `spellingOf` makes the comma pieces and where `spelledParts` makes the parts. The pile is read with the rules (`currentRules`, beside the units and the words), and the cache is dropped when the pile changes, so a cleanup step that adds to it resolves with it at once.
- No `RUNG_VERSION` bump: on the copy (`m31c_post_on`) no spelling holds a pile seed text except "boneless" and "lbs boneless" (ticket 46's), so no stored resolution changes.

**Removing a spelling by hand (Mike, 2026-10-22: "a popup when it's the last asking if it's junk and should be marked as such").** Today a spelling is removed in the Ingredient panel's Translations sub-panel (`apps/web/components/ingredients/ingredient-panel.tsx`, `spellingChip`): its cross stages the removal in the draft (`removed`, struck through), and Save sends it through `trpc.ingredients.saveDraft` (`packages/trpc/src/routers/ingredients/index.ts`) to `saveDraft` → `removeAliasIn` in `packages/shared-server/src/ingredients/catalogue.ts`. There is no dialog yet. (The `ingredients.removeAlias` procedure and `removeAlias` have no web caller; they stay a plain delete.)

- **Another food still holds the text** (another alias with the same fold): the cross stages a plain removal, as today. Nothing goes on the pile.
- **The last copy of the text in the catalogue:** the cross opens a small confirm modal, shaped like `DeleteIngredientModal` (`delete-ingredient-modal.tsx`). "Not a food" stages the removal and marks it for the pile. "Just remove" stages a plain removal. Closing it stages nothing.
- **What the client needs:** `IngredientSpelling` (`spelling()` in `catalogue.ts`) gains `elsewhere: boolean`, true where another food holds the fold, read by one repository query beside the spelling read.
- **What the server does:** the draft gains `junk: string[]`, the alias ids marked for the pile and a subset of `remove`. The `saveDraft` input gains `junk: z.array(z.uuid()).max(100)`. `removeAliasIn` puts the fold on the pile only for an id in `junk` and only when, in the transaction, no other alias holds the fold. A stale `elsewhere` then just deletes. A refused Save restores `junk` with the rest of the draft.
- **Copy** (`settings.ingredients`, sentence case, in all 16 locale folders under `packages/i18n/src/messages/`):
  - `junkTitle`: "Mark {alias} as not a food?"
  - `junkBody`: "No other ingredient has this translation. New recipes skip text marked as not a food."
  - `junkRemove`: "Just remove" (`ActionButton action="remove"`)
  - `junkMark`: "Not a food" (`ActionButton action="delete"`)

**The pile seed (Mike, 2026-10-22: "perhaps we can also preseed the junk table a bit so the parser is more accurate and remains so").** A short committed list of generic texts that name no food, put on the pile at boot like the seed corrections. Each entry is a text plus the version it came in, `JUNK_SEED` in `packages/shared-server/src/ingredients/seed/`, beside `SPELLING_MOVES`. The seed state gains `junkSeedVersion`, run through `oncePerVersion`. A pass from version N inserts only entries added after N (`reason: "seed"`, no change id, an existing fold left alone), so an entry a person took off is never added again. It runs whether or not the catalogue seed is configured.

The list (33 entries, version 1). It holds no production recipe text: only generic words, taken from what AI deleted as not a food on `m31c_post_on` (13 AI Changes, kind `not-a-food`) plus Mike's examples. English and Dutch, plus the headings, "to taste" and "optional" in German, French, Spanish and Italian, where that was cheap:

- **Headings:** ingredients, ingrediënten, zutaten, ingrédients, ingredientes, ingredienti
- **To taste:** to taste, naar smaak, nach geschmack, au goût, al gusto, q.b.
- **Optional:** optional, optioneel, facultatif, opcional, facoltativo
- **Line fragments:** boneless, skinless, chopped, roughly chopped, melted, overnight
- **Kitchen tools:** bakvorm, cakevorm, springvorm, keukenmachine, deegroller, baking dish, food processor, rolling pin
- **Broken text:** null, undefined

Left out from the copy's AI deletions because they are a recipe's own wording: "Bakvorm met opstaande randen of een braadslede", "Brownie bakvorm", "Quichevorm of springvorm van ca.", "solid part a little more than". "[object Object]" is left out too: `lineNamesNoFood` has named it no food since 22f4526c3 (`RUNG_VERSION` 3). On the copy, the 18 "[object Object]" / "null [object Object]" lines of the one AH recipe already name no food (no `recipe_ingredient_foods` rows). Ticket 48 fixes the import bug that can still write it.

**Seeing and clearing it:** Changed by AI's Undo clears what AI put there, and adding the spelling back clears a person's removal. That suffices for now.

- **Later:** a page to view and edit the pile. No ticket now.

**Blocked by:** None. Ticket 46 adds its "not a food" spellings to the pile, and relies on the piece rule for its lines.

**Status:** done

- [x] After AI deletes "melted" as not a food, a new recipe with the line "melted" stores it as written, names no food, mints nothing and asks no AI. Undo of that AI Change takes "melted" off the pile, and the next import mints it again.
- [x] With "boneless" on the pile, "boneless, skinless chicken breasts" is read on "skinless chicken breasts", never as no food. "boneless" alone names no food.
- [x] Removing by hand the last "boneless" in the catalogue asks; "Not a food" puts it on the pile, "Just remove" does not. Removing a spelling another food also holds asks nothing and puts nothing on the pile. Adding "boneless" by hand to any food takes it off.
- [x] After the first start, the 33 seed texts are on the pile. An entry a person took off stays off across restarts and later seed versions.
- [x] A typed Grocery "boneless" is kept, naming no food.

## Implemented (2026-10-22)

- **Table** `ingredient_junk_pile` (migration 0081_junk_pile): `fold` (unique), `reason` (`not-a-food` | `person` | `seed`), `ai_change_id` (FK to `ingredient_ai_changes`, on delete set null, so the month's sweep of AI Changes keeps the entry), `created_at`. Schema `packages/db-schema/src/schema/ingredient-junk-pile.ts`.
- **Repository** `packages/db/src/repositories/ingredient-junk-pile.ts`: `listJunkFolds()`, `addToJunkPile(tx, folds, { reason, aiChangeId })` (an existing fold keeps its entry; answers how many were added), `takeOffJunkPile(tx, folds)`, `takeJunkOfAIChange(tx, aiChangeId)`. `recordAIChange` now answers the new change's id. **Ticket 46** puts a "not a food" spelling on the pile with `addToJunkPile(tx, [fold], { reason: "not-a-food", aiChangeId })` in the transaction that records its `spelling` AI Change, then calls `forgetSpellingRules()` (resolver) after it commits; its Undo is covered by `undoAIChange`, which calls `takeJunkOfAIChange` for every kind.
- **Resolver** (`resolver.ts`): `currentRules()` reads the pile beside the units and the words (`ResolverRules.junk`). `withoutJunk(pieces, rules)` is the one drop, called by `spellingOf` on the comma pieces (`commaPieces`, outside brackets) and by `spelledParts` on the joining-word parts. All pieces dropped: the text names no food (a recipe line is a Junk Line, a typed grocery keeps its text with no food). Parts all on the pile name no food too (`resolveTexts` skips a split with no foods). One part left after the drop names that part's food when rungs 1-2 know it; otherwise the whole text is minted as before (not built further).
- **Cache.** `forgetSpellingRules()` runs after `deleteByAI`, `undoAIChange`, `addAlias`, `saveDraft` and the seed. It only clears the process that made the change: on the E2E stack AI's pass deletes in the workers and the next import reads a pile up to `RULES_TTL_MS` (10 s, now exported) old, as a units-map edit always has. The browser spec waits that long.
- **AI.** `deleteByAI` piles every spelling's fold of the deleted food with the change id; Undo takes them off.
- **By hand.** Folds are unique instance-wide (`uqidx_ingredient_aliases_fold`), so no other food can hold a spelling's text and the ticket's `elsewhere` would always be false: it was left out, and the cross on every removable spelling asks (`JunkSpellingModal`, `apps/web/components/ingredients/junk-spelling-modal.tsx`). "Not a food" stages the removal in `removed` and `junk`, "Just remove" only in `removed`, closing stages nothing, and the undo arrow clears both. `IngredientDraft.junk` / the `saveDraft` input `junk: z.array(z.uuid()).max(100).default([])`; `removeAliasIn(…, junk)` piles the alias's fold (`findCatalogueAliasOwner` now returns `fold`) with reason `person`. `addAliasIn` takes the fold off. `ingredients.removeAlias` stays a plain delete. Copy `junkTitle`, `junkBody`, `junkRemove`, `junkMark` in all 16 locales.
- **Seed.** Mike (2026-10-22, during the work): every entry in every language Norish reads. `JUNK_SEED_CONCEPTS` (`packages/shared-server/src/ingredients/seed/junk-pile.ts`) holds 14 concepts (ingredients, to taste, optional, boneless, skinless, chopped, roughly chopped, melted, overnight, baking dish, cake tin, springform pan, food processor, rolling pin), each with a text for all 17 `CATALOGUE_LANGUAGES` (a test checks every concept has every one), plus "null" and "undefined" in any language. `JUNK_SEED` flattens them once per fold: **211 entries**, all version 1. Dutch "chopped" is "fijngehakt", since "gehakt" is minced meat. Translations are mine, unmeasured. `seedJunkPileOnce(seed = JUNK_SEED)` runs through `oncePerVersion("junkSeedVersion", …)` (new `IngredientSeedStateSchema.junkSeedVersion`), inserting only entries newer than the version last run, so an entry a person took off stays off. Boot step `seedJunkPileOnBoot` (`packages/api/src/startup/seed-junk-pile.ts`) runs right after `cleanUpCatalogueOnBoot`, so the first-start cleanup reads spellings as 0.25 left them and does not remove "boneless" without AI (ticket 46's job). It runs with or without a catalogue seed.
- **No version bump** (`RUNG_VERSION` 10, `CLEANUP_VERSION` 4, `SEED_CORRECTIONS_VERSION` 3). Read-only check on `m31c_post_on`: of the 211 seed folds, only "boneless" is a spelling (chicken breast, 5 lines). Stored rows are not resolved again.
- **Tests:** `resolver-ai.test.ts` (AI's deletion piles "melted", the next line mints nothing and asks nothing, Undo takes it off), `resolver.test.ts` "the junk pile" (comma pieces, "lbs boneless" by its plain fold, a joining-word part, all-junk, a typed grocery), `catalogue.test.ts` (a draft's junk removal piles, adding the spelling clears it), `catalogue-seed.test.ts` "the junk pile seed" (211 once, a later version adds only its own, never one a person took off; every concept in every language), trpc `ingredients.test.ts` (junk only for marked ids), web `ingredients-settings-content.test.tsx` (the confirm), E2E `ai/ingredient-catalogue.e2e.ts` (the junk scenario now uses "uitgelekt", since "gesmolten" is seeded, and checks the next line names no food; a new scenario walks the confirm both ways and "boneless" added by hand).
- **Docs:** Ingredients page paragraph and the removal sentence, a 0.26 release-notes line and an upgrade note, CONTEXT.md **Junk Pile**, ADR-0037 amended. No new screenshot of the confirm.

- **Gates run:** shared-server 1219, db 323, trpc 615, api 524, shared 955, web 1334 unit tests green; full browser E2E 219/219; `pnpm typecheck`, lint of the touched packages (no new warnings) and `pnpm i18n:check` clean.

**For Mike.**

- Every spelling removal now asks, as folds are unique (see above). Say if you want it only for some spellings (an own one, say).
- The seed's translations are unchecked by a native speaker; a word that is a real food in some language would make that food's one-piece lines name nothing until someone adds it as a translation.
- "boneless and skinless chicken" (a joining word, one part left that rungs 1-2 do not know) still mints the whole text.

## Review fixes (2026-10-22)

- **One part left.** The drop now happens in `spellingOf` itself (`withoutJunkPieces`): comma pieces, then joining-word parts, on the pile are cut, and a part left keeps the joining word before it (`JoinedParts.words` carry their `text`). The text is then read and minted on the pieces left, so "boneless and skinless chicken" mints "skinless chicken", and "boneless of salt or pepper" splits on "salt or pepper" (the old `words.slice` paired "of" with them and refused the split). `spelledParts` no longer drops anything.
- **Cleanup.** The first-start cleanup reads names without the pile (`cleanupRules`, used by `cleanSpellingOf` and `partsByWordsOf`), so a later `CLEANUP_VERSION` never removes or renames a junk spelling without AI; that stays ticket 46's.
- **Undo** takes the folds a change removed off the pile, whoever put them there (see ticket 46); `takeJunkOfAIChange` is gone.
- `forgetSpellingRules()` runs only when the pile changed (`addToJunkPile`/`takeOffJunkPile` counts); `removeAliasIn` takes `{ of, junk }`.
- The "For Mike" note on "boneless and skinless chicken" no longer holds.
