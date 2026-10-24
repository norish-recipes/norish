# 56: Two prompts, and a food is never merged into its parent

**What to build:** The `ingredient-resolution` prompt served two requests: reading a name, and the second question (which listed food the name is). Split it: `ingredient-resolution` keeps the reading, a new `ingredient-match` takes the second question, and each field's meaning moves into the answer schemas' `.describe()`. The second question answers with the food's name instead of its number. Separately, root cause 2 of ticket 50 (ticket 52's shape): "pumpkin puree" merged into pumpkin, which holds "pureed pumpkin", although AI read pumpkin as its parent.

**Decided (Mike, 2026-10-22):** the prompt texts are his, final. Keep the brand line in the match prompt and in the Decision's instructions; drop the "Unox Knaks is sausage" example; category stays a fallback (used only when the catalogue has no food named the parent); the match answer is the candidate's exact name, via a per-request nullable enum, no numbers in the list. New code rule: a food is never merged into the parent AI gave it. When AI's names find the same food as the reading's parent, the name is filed under that parent instead ("italian sausage stays its own food under sausage").

**Blocked by:** None

**Status:** done

- [x] Pumpkin puree stays its own food under pumpkin, though pumpkin holds "pureed pumpkin".
- [x] Italian sausage is filed under sausage, though AI's other name "salsiccia" is sausage's spelling (the ticket 50 test flipped).
- [x] The second question goes under `ingredient-match`, lists foods as `- name (...)`, and only a listed name or null parses.
- [x] `ingredient-match` is an administrator-editable prompt: loader, config schema, system message, admin form row, i18n in all 16 locales.

## Implemented (2026-10-22)

- Prompts: `packages/shared-server/src/ai/prompts/ingredient-resolution.txt` (Mike's A) and new `ingredient-match.txt` (Mike's B, last line asks for the candidate's name). Registered in `prompts/loader.ts`, `prompts/overrides.ts` (`PROMPT_CONFIG_FIELDS`), `PromptsConfigSchema` (`ingredientMatch`), `ai/runtime/system-messages.ts` ("You keep a catalogue of foods and say which listed food a name is, or that it is none of them."), `prompts-form.tsx`, `settings.admin.promptsConfig.ingredientMatch*` plus a rewritten `ingredientResolutionDescription`. The E2E fake provider routes the new system message to the ingredients lane.
- `ai/resolution/ingredient-resolution.ts`: `pickSchema` is gone; `matchSchema(candidates)` is a nullable `z.enum` of the candidates' names, and `askLanguageModel` maps the name back by `candidates.find` (names are unique ignoring case). The number-off-the-list branch is gone: under JSON mode an off-list name fails the parse and the food is flagged `ai-unavailable`. Reading schema and `foodChoice` instructions take the approved texts. The Decision use stays `ingredientResolution`.
- The code rule is in `readThenLookUp`: when the names found a food and the reading has a parent, the parent is looked up (`findByName`); a find equal to it falls through to the parent filing, which reuses that lookup. One more catalogue lookup per such food. Split parts are left out (no parent filing). A brand keeps merging only while AI gives it no parent of its own name; no guard for that, the `parent` describe asks for it. Narrowed by ticket 57: the rule holds only when the food was found through AI's other names or a slip, not by its English name.
- Tests: `review.test.ts` "AI's names, looked up as written" (pumpkin puree, italian sausage), `picks(name, sure)` queued under `ingredient-match`, the sections test checks the schema rejects an off-list name; `new-prompt-defaults.test.ts` checks both shipped prompts and all sixteen defaults.
- Docs: the 0.26 upgrade note on the Ingredient resolution prompt rewritten (split, the match prompt, restore an edited default), a release-notes line under Fixes, an ADR-0037 amendment (it reverses ticket 50's "salsiccia is sausage" for a name whose parent is that food).

**Left, for Mike.**

- Mike's text said "Return the candidate's number"; per his earlier ask that the match answers with the exact name, the last line of `ingredient-match.txt` says the name.
- The admin Prompts screenshot (`apps/docs/static/img/screenshots/admin-prompts.png`) does not show the new row; not retaken.
