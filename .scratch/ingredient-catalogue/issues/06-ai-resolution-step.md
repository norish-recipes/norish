# 06: AI resolution step

**What to build:** Add rung 3 of the resolution order. When no alias matches, a Decision under a new Decision Use, _ingredient resolution_, is asked about the text. Its state is the text, and its candidates are the Ingredients whose aliases share a word with it. It answers _match X_, _new_ or _new, child of X_; the _child of_ answer is acted on in 09 and treated as _new_ until then. A Clear Case above a named threshold constant is acted on: a sure match adds the text as an alias of X, so the next occurrence matches exactly. Below the threshold, or when the Decision Model is unconfigured or switched off for this use, a language-model request under a new administrator-editable Prompt answers the same question. An Ingredient minted after an unsure answer, or without AI, is flagged.

**Blocked by:** 01

**Status:** done

- [x] The _ingredient resolution_ Decision Use exists in configuration and follows the global AI switch.
- [x] A new Prompt with a shipped default is appended to per ADR-0016, and is editable in the admin prompt settings.
- [x] The threshold is a named constant with a test at its boundary.
- [x] Tests mock `decide` as the one AI seam, and mock the runtime for the language-model path. They cover a sure match, an unsure answer, no AI, and a Decision failure falling back to the language model.
- [x] An import never fails because resolution's AI failed: it falls through to a flagged mint.

## Comments

- Rung 3 lives in `packages/shared-server/src/ingredients/ai-resolution.ts`; `RESOLUTION_THRESHOLD` is 0.8, higher than grocery linking's 0.5, because a wrong match silently lends one food's links to another while a wrong mint is one merge.
- "Shares a word" is read as "has a word starting with the same four letters", so "onions" finds "onion" and "tomatoes" finds "tomato"; exact word sharing would miss every plural. The search is a `LIKE` scan over alias folds with no index; revisit once the seed (10) has filled the table.
- A text that has no candidates at all is asked nothing and minted **unflagged** while AI is on: there is nothing it could duplicate that AI could have seen. Translations with no shared letters ("ui" for "onion") are the seed's to know.
- The language model says itself whether it is sure (`sure` in its answer). An unsure "same" mints a flagged food rather than joining one; an unsure "new" or "kind-of" is a flagged mint.
- Texts in one call that resolve alike (same bare fold) are asked once, and at most four questions run at a time.
- The upgrade backfill resolves with `{ ai: false }`: it walks an instance's whole history at boot.
