# 22: Ask AI about every flagged ingredient, with a token estimate

**What to build:** Mike, 2026-10-04, on the production copy (1,337 flagged ingredients): the header's **Ask AI about flagged ingredients** should open a modal where you pick every flagged ingredient or only the flagged ones without a suggestion, and see about how many tokens the round will use.

Until now the button started a round at once over the flagged foods **on screen**: a page of fifty, and never more than the router's cap of 500 ids.

**Blocked by:** 06, 13

**Status:** done, pending review

- [x] The button opens a dialog, `ask-ai-round-modal.tsx`, with two scopes (`REVIEW_SCOPES`). Each scope shows its ingredient count and token total; one footnote says what the tokens are based on:
  - **Only those without a suggestion**, listed first and picked by default. It is the gap, the way Bulk Enrichment fills gaps by default.
  - **Every flagged ingredient**, which replaces the suggestions already waiting.
  - Each scope shows its count across the whole catalogue. A scope with nothing in it is disabled, and the person's pick stays for the next round.
- [x] The server picks the foods: `reviewAllWithAI({ mode: "review", scope })` reads `listReviewableIngredients(actor, scope)`. That is every flagged food under the edit policy, by name, with whether any suggestion (`ai` or `words`) waits on it. The answer carries `pending`, the ids the page marks. "Find parents with AI" keeps sending the ids on screen.
- [x] `ingredients.reviewScope` gives `{ flagged, unsuggested, tokens }`.
  - `tokens` is **measured** when it can be: the newest finished round the queue still holds whose ledger counted tokens. It is that round's tokens over the foods it asked (a food passed over asked nothing), from up to 10 completed jobs.
  - Otherwise it is estimated from the **prompt**: `estimateQuestionTokens` sends nothing. For up to five of the round's names, spread over the list, it counts the reading, the comparison with the candidates the name's words find, and a Decision where one is in use, plus 50 tokens per answer. Every request counts in full.
- [x] The model-use ledger records `tokens` per request (`reportedTokens`: total, else input + output). A provider that reports no usage gets no number, because the SDK hands that on as 0.
- [x] The runtime got `estimateStructuredInputTokens` and `estimateDecisionInputTokens`. They count what a request would send at four characters a token: the system message, the administrator's prompt as it stands, the sections, and the schema (as the plain-JSON instruction renders it). `assemblePrompt` is the one place a prompt is put together, so the estimate cannot drift from the request.
- [x] The worker writes the round's steps and announces its count every twentieth of the round (`ROUND_WRITES`, `recordCompletedSteps`), not after every food. Each step now carries the food's real ask time.
- [x] The monitor's "hanging" threshold for a round went from 1 hour to 4.
- [x] The job monitor shows the tokens a job used: a total, and per model on its chip.
- [x] Copy in all 15 locales. Docs (Ingredients, with `ingredients-ask-ai.png`) and the release-notes bullet are updated.
- [x] Tests:
  - runtime: tokens on the ledger, both estimates;
  - review: scope listing, the estimate;
  - worker: batched writes, step timings, `readRoundTokens`;
  - router: scope, `reviewScope` measured and from the prompt;
  - the dialog and the page;
  - the catalogue browser spec, through the dialog with the "unsuggested" scope.

## Comments

- 2026-10-04: **Why the worker batches.** Measured on the production copy's Redis:
  - Job progress is one JSON value rewritten whole on every write, and BullMQ's `updateProgress` also appends it to the queue's events stream. That stream keeps 10,000 entries, and nothing reads the progress events.
  - The copy's two rounds (100 and 200 foods, 474 bytes a step) had already left 23.8 MB in the stream.
  - One round over all 1,337 flagged foods would have stored about 850 MB.
  - Twenty writes keep it linear, about 6.6 MB for that round.
  - A per-queue `streams.events.maxLen` does not hold, because every `new Queue()` for the name rewrites the meta key back to 10,000, and the lazy worker opens its own.
- 2026-10-04: **Measured per-request usage on the copy** (gpt-5.6-luna with the jev Decision, 300 foods):
  - reading: 748 in / 165 out;
  - comparison: 959 in / 178 out;
  - Decision: 1,412 in / 300 out;
  - about 3,550 tokens a food.
  The prompt-based estimate leaves out reasoning tokens and the Decision Model's own framing, so it runs about a quarter low. The dialog says so, and the first measured round replaces it.
- 2026-10-04: **What changed in existing behaviour.**
  - The bulk button no longer narrows to the screen: a search or filter does not limit the round. The panel's single-food Ask AI still covers one-offs. A third scope ("the N on screen") is the obvious follow-up if wanted.
  - "Only those without a suggestion" leaves out a food with a `words` suggestion too, since that is a suggestion waiting in the panel.
  - Rounds that ran before this change counted no tokens, so the dialog estimates from the prompt until a new round finishes.
- 2026-10-04, Mike's review of the first dialog: "Icon and title together. The warning needs to have some padding … design is simply off." He also quoted the prompt-basis line.
  - The icon sat above a centred title. HeroUI's `.modal__header` is `flex-col`, and our `items-center` centred it. Now `flex-row` with `Modal.Heading`.
  - `gap-4` on `Modal.Body` did nothing, because the body is not a flex container, so the estimate box touched the text above it. The body is now a column on a 16px rhythm (the radio group's own `mt-4` plus `mt-4` on the footnote).
  - The token box used warning colours for something informational. It is gone. Each option now reads "935 ingredients · about 2.4M tokens", so the two choices compare at a glance. One short muted footnote says what the counts are based on.
  - The start button is plain "Ask AI". The long "Ask AI about 935 ingredients" overflowed the footer on a phone.
- 2026-10-04, Mike: show the tokens consumed in the job monitor. `AdminJobModelDTO.tokens` is the sum over that chip's requests, null where nothing was reported. The detail modal shows a **Tokens** total beside Attempts, and each model chip carries its share in compact form. This applies to every AI job, not only rounds.
- 2026-10-04, Mike, mid-round: "I don't see in the UI what is queued its just loading the first item."
  - A round over the catalogue mostly asks about foods that are not on screen: kinds folded under a parent in the tree, and pages not loaded yet. So the per-row chips showed one spinner and nothing else. On the copy, "160e peanut butter" sorts first but sits folded under its parent.
  - `pending` now shrinks as answers are written down, and a row drops its "Asking AI…" chip when its answer is in.
  - While a round runs, the header shows **Asking AI · 470 of 935** in place of the start buttons. It opens the Suggestions panel, which leads with a progress bar and, folded, the foods still waiting (`ReviewReport.waiting`, by name).
  - Every progress event refreshes the list, the suggestions and the report, so answers appear as they are written (every twentieth), not only at the end.
- 2026-10-04, Mike: "the prompt should show the tokens per model."
  - `ReviewTokenEstimate` carries `models: ModelTokenEstimate[]`. When measured, it is each model's tokens over the foods the last round asked. When estimated from the prompt, the runtime's estimators return the model each request would go to (`TokenEstimate`).
  - The dialog lists each model's share of the chosen round under the options, in the job monitor's "provider · model" form.
- 2026-10-04, Mike: "the suggestions panel needs to be a virtualised list as performance can take a hit with 1300."
  - Every part of the panel is one TanStack virtual list over the panel's own scrolling body: progress, waiting names, suggestions and no-suggestion entries. Rows are measured. About 15 rows are in the DOM of 1,288.
  - Trap: the panel body is a flex column, so the list needs `shrink-0`. Without it, the list shrinks to the body's height, and the scroll range starts tiny and grows as you scroll.
  - Unit tests mock `useVirtualizer`, because jsdom lays nothing out.
- 2026-10-04, the copy's first measured round (935 foods, job 3):
  - 3,757,879 tokens: gpt-5.6-luna 1,827,548 over 1,740 requests, jev-1.13.0 1,930,331 over 925 requests.
  - About 4,019 per food. The prompt-based estimate (2,563) was 36% low.
  - The median ask took 5.9 s, p90 9.7 s. 935 foods took about 10 minutes at concurrency 10.
- 2026-10-04, Mike: "Confirm all on 1300 entries lags the UI."
  - Two causes. The browser patched its cache once per suggestion, three `setQueriesData` calls each copying every loaded row: about 3,900 full rewrites in one synchronous loop.
  - And the server refused the request, since `suggestionIds` was capped at 500 (two 400s in the copy's log). So nothing was confirmed after the freeze, and the rollback brought everything back.
  - Now the hook works out every row's patch first and rewrites the lists once (`patchRowsById`). Measured on the copy: 1,311 answered, the panel empty 73 ms after the click, no long task.
  - The cap is 5,000.
  - `answerSuggestions` runs inside `announcingTogether` (an AsyncLocalStorage-scoped hold in `ingredients/changes.ts`), so a batch is one `changed` announcement, not one per suggestion. Each announcement makes every open tab refetch six query families.
  - Confirm all runs in `inConfirmOrder`: parents and "its own food" first, then merges from the far end of each chain. A merge takes its food away, and the FK cascade takes every suggestion naming that food.
  - A suggestion gone by its turn (`not-found`) counts as settled, not refused.
  - Measured on a clone of the copy: 1,311 confirmed in 5.7 s, the order computed in 15 ms. Unordered, 104 failed with not-found; ordered, 0 failed and 66 settled. Those 66 were mutual pairs, two flagged duplicates suggested into each other, which the first merge settles.
- 2026-10-05, Mike: "why do we have a limit?" No product reason.
  - The 500 caps on `suggestionIds` and on Find parents' `ingredientIds` were a defensive default from ticket 13 (abf46d84). A list can never be longer than the catalogue, and the server sets no body limit.
  - Both caps are gone.
  - The one real ceiling: each list becomes a single `IN (…)` query, and Postgres takes at most 65,535 bind parameters. 65,535 work and 70,000 fail ("bind message has 4464 parameter formats": the 16-bit count wraps).
  - `findIngredientSuggestions` and `findCatalogueIngredientNames` now look up a thousand ids to a query (`CHUNK`, as the seed and nutrition repositories do). A test runs 70,000 ids through both.
