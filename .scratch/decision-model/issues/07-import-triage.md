# 07 — Import triage: three cheap questions before the expensive step

Status: ready-for-human
Blocked by: 04

Spec: `.scratch/decision-model/spec.md`

## What to build

The URL and video import pipelines gain three questions that nothing asks today, each asked only when a Decision Model is configured and each with today's rule as the fallback:

1. **Is this page a recipe?** Asked of the sanitized page text when the structured parser found no recipe, before an AI extraction is attempted. A clear "no" refuses the import with the message the parser already uses ("Page does not appear to contain a recipe."); anything else proceeds to extraction.
2. **Does this caption hold a recipe?** Asked of an Instagram or Facebook caption where the processor today counts characters: to decide whether to extract from the caption before paying for a transcription, and whether a photo post is importable at all.
3. **Is the structured parse complete enough?** A Score on the recipe the structured parser returned. Below the constant, AI extraction runs for this page as if `alwaysUseAI` were on.

## Notes

**Question 1** replaces, when configured, `isPageLikelyRecipe` in `packages/api/src/parser/index.ts` — today a count of hits from the administrator-editable content-indicator list (~70 words, nine languages), requiring two. Ask one Boolean on the output of `extractSanitizedBody` (already the text the extractor would see, capped at 50 000 characters) with the instruction "Is this page a cooking recipe with ingredients and instructions?". Constants: `NOT_A_RECIPE_THRESHOLD = 0.15` — at or below, refuse; above, proceed. Refusal is the _only_ action a Decision takes here; a "probably yes" changes nothing, and the keyword list remains the path with no Decision Model. The content-indicator setting keeps its meaning and its admin editor.

**Question 2** is the same Boolean on the caption text in `packages/api/src/video/processors/instagram.ts`, replacing the five length thresholds (50/50/50/200/50) with one answer where configured. Order of operations does not change: a clear "yes" on a video post still means "try the caption before transcription"; a clear "no" on a photo post is the existing "Instagram image posts are only supported if the caption contains a recipe" error. The `unknown` video-stream branch (#513) is untouched — a Decision has no more evidence about a video stream than the downloader had.

**Question 3** is a Score, three levels — `["Not a usable recipe: missing ingredients or steps", "Usable but incomplete: some ingredients, steps, times or servings missing", "Complete"]` — on the JSON the structured parser returned (`tryStructuredParser`'s adapted output, before normalisation). `INCOMPLETE_PARSE_MAX_SCORE = 0.9`: an expected score at or below it sends the page through `extractWithAIPreference` as `alwaysUseAI` would; above it, the parse is kept. `alwaysUseAI` keeps meaning "always" and is checked first. Today success is "has a name", so a title with two ingredients ships; this is the fix, per page, without the global switch.

None of the three has an administrator switch: they are Norish's own algorithm, they only ever make an import cheaper or refuse a page that was never a recipe, and the maintainer's rule is that what the Decision Model does for the algorithm is not a household preference. They run whenever a Decision Model is configured.

All three go through a small helper in the parser (`packages/api/src/parser/import-triage.ts`) that owns the constants, composes the state, calls `decide`, and swallows every `AIError` into "no opinion" with a warn log — so each call site reads as `(await triage.isRecipe(text)) ?? keywordRule(text)`.

Each question is one Decision; do not batch the page and the parse into one request, since they are asked at different points and the second may not happen.

Recording, in this ticket's comments, the observed latency of question 1 on a 50 000-character page: it sits on the import's critical path and the answer decides whether the Score question is worth its round trip.

## Acceptance criteria

- [x] With a Decision Model configured: a non-recipe page whose structured parse failed is refused after one `decide` call and no `generateStructured` call; a recipe page proceeds to extraction as today.
- [x] With a Decision Model configured: an Instagram photo post whose caption clearly holds no recipe fails with the existing message; a video post whose caption clearly holds one is extracted from the caption before transcription.
- [x] With a Decision Model configured: a structured parse scored as incomplete is sent through AI extraction; a complete one is kept; `alwaysUseAI` still forces extraction regardless.
- [x] With no Decision Model, or any `AIError` from `decide`: every path is today's (the keyword rule, the length thresholds, "has a name"), and the existing parser and processor tests pass untouched.
- [x] Boundary tests on all three constants.
- [x] The processor entry-point test from `.scratch/import-and-provider-fixes/issues/04` still covers all four video paths.
- [x] There is no use switch for triage; the Uses group in the admin form says so.
- [ ] Latency recorded in the comments.
- [x] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Removing the content-indicator list or its admin editor.
- The video-stream classification.
- Duplicate detection ("same dish?") — a separate spec.

## Comments

- Filed 2026-09-19 with the spec.
- Future candidates found in the sweep, not planned: measurement-system inference (`determine-recipe-system.ts`, a 2-way Choice), the `1:30` timer ambiguity (`timer-parser.ts`), recurrence phrases, image-candidate ranking (`parsers/images.ts`), store-page price reading. Each is deterministic enough or client-side today.
- 2026-09-19 — Implemented. `packages/api/src/parser/import-triage.ts` owns `NOT_A_RECIPE_THRESHOLD = 0.15`, `INCOMPLETE_PARSE_MAX_SCORE = 0.9` and the three-level rubric, composes the state (page text capped at 50 000 characters; the parsed recipe as JSON), and turns any `AIError` or the absence of a Decision Model into `null` with a warn log. Call sites: `parser/index.ts` asks `isRecipe(extractSanitizedBody(html))` where `isPageLikelyRecipe` used to be the gate (the keyword rule is the `??` fallback) and `isParseComplete` on a successful structured parse when AI is enabled (`alwaysUseAI` is checked first and skips it; a failed extraction keeps the parse); `video/processors/instagram.ts` asks `isRecipe(caption)` where the 50/200/50 length thresholds stood, each length staying as the fallback. The two `> 50` checks inside `extractCaptionFromHtml` are HTML-parsing heuristics about which meta tag to read, not a question about the caption, and are unchanged. The Uses group's description already says import triage is not in the list. **Not done:** the latency of question 1 on a 50 000-character page needs a real key (see ticket 04). Tests: `import-triage.test.ts` (12), `import-flow.test.ts` (+8), `instagram-processor.test.ts` (+5).
- 2026-09-20 — Review fix, and the status corrected: the ticket was marked resolved with the latency item undone, so it now waits for a person like tickets 04 and 11 — the latency of question 1 on a 50 000-character page needs a real key, and that measurement decides whether the Score question is worth its round trip. Two code changes. (1) A video's caption went to extraction on "not clearly no" rather than the clear "yes" this ticket names: a caption at probability 0.3 paid a language-model extraction the 200-character rule would have skipped. `judgeRecipe(text)` now returns `"no" | "unclear" | "yes" | null` with `CLEARLY_A_RECIPE_THRESHOLD = 0.85` beside the refusal constant; `isRecipe` reads its refusal off it unchanged. In `instagram.ts` only a clear "yes" skips the audio, a clear "no" goes straight to it, and "unclear" leaves the 201-character rule in charge as before; the photo post and the audio-failure fallback keep refusal-only. (2) The audio-failure path asked triage about the same caption twice; the one verdict now serves both places. Boundary tests on the new constant, and five Instagram cases including asked-once.
