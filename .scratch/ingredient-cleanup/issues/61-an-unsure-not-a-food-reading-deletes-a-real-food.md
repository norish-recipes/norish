# 61: An unsure "not a food" reading deletes a real food

**What to build:** Found by ticket 31's run after tickets 57, 58 and 60 (2026-10-22, HEAD 67eb2082a, `m60_post_on`). AI read a product name it did not know as gibberish, unsure. Mike's rule (128077595) deletes a food AI calls not a food, sure or not, so the food went and its recipe line now names no food. Last run the same name was read, unsure, as the food it is and merged into it.

On the copy: 1 food, 1 recipe line. Ticket 59's deleted split part is the same rule on a part minted by a split.

To decide: does an unsure "not a food" still delete, or is it flagged like any other unsure answer?

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-22)

"build all 4", on ticket 08's rule (2026-10-20): AI deletes a tool when unsure too, with Undo; an unsure "names nothing" only flags `ai-junk`. Ticket 13 had made "one not a food" acted on sure or not (ADR-0037, 2026-10-20), so the unsure-nothing half was gone before ticket 60, not lost by it; that "sure or not" now holds for a tool only.

## Implemented (2026-10-22)

- The reading keeps its not-a-food `reason`: `Reading` and `AIResolution` not-a-food are `{ kind: "not-a-food"; sure; tool }`, `tool` = reason `equipment` (`ai/resolution/ingredient-resolution.ts`). In `askAIAbout` (`ingredients/review.ts`) a sure answer or a tool goes to `deleteByAI` as before; an unsure one that is not a tool goes to `doubted(id, "ai-junk")`: flagged, nothing deleted, no AI Change, nothing on the junk pile.
- Tests (`review.test.ts`, "several foods, and not a food"): an unsure tool (taartvorm) is deleted; an unsure gibberish (tortacles) is only flagged `ai-junk`, with no AI Change and an empty junk pile. `noFoodReading(sure, reason = "equipment")` in the test helpers.
- CONTEXT.md (Junk Line), an ADR-0037 amendment, the Ingredients docs page and the 0.26 release-notes feature text say an unsure fragment is only flagged.
- Ticket 59's deleted split part follows the same rule now when the part's reading is unsure and not a tool.
