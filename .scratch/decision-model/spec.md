# Decision Model: Jev answers the questions a language model was never the right tool for

Status: ready-for-agent

Reference: TypeSafe AI's Jev, reached through the AI SDK's TypeSafe provider
(`@ai-sdk/typesafe-ai`, https://ai-sdk.dev/providers/ai-sdk-providers/typesafe-ai).

## Problem Statement

A surprising share of what Norish asks a language model is not generation at all. Auto-categorization asks for four labels and gets back prose-shaped JSON it then fuzzy-matches onto the four labels it already had. Allergy detection hands over the household's allergen list and asks which of them are present, then trusts a free-text array it cannot score. Auto-tagging under the predefined strategy asks a model to pick from thirty-seven words. Every one of these is a **closed question**: the answer space is known before the request is sent, and what Norish actually wants is a pick and a measure of how sure the pick is. A language model gives the pick, at the cost and latency of writing it out, and gives no honest measure of anything — a `0.9` it writes into a JSON field is text, not a probability.

The cost is not abstract. Automatic Recipe Enrichment runs several of these requests for every newly usable recipe, the bulk sweep runs them for every recipe on the server, and each is a full structured-generation round trip: prompt, schema, tokens out, a JSON parse, a domain re-check. On a self-hosted local model that is seconds per kind per recipe; on a paid provider it is a bill that scales with the household's library rather than with the number of decisions actually made.

There is a second shape of question Norish does not ask at all today because a language model is too expensive to ask casually. Before the URL import spends an AI extraction on a page, nobody asks whether the page is a recipe. After the structured parser returns something, nobody scores how complete it is; a fixed rule decides whether AI runs again. After an enrichment kind proposes a claim, nothing verifies it. These are cheap questions with expensive consequences, and the product has no cheap way to ask them.

TypeSafe AI's **Jev** is a different kind of model for exactly this. It generates nothing. Given a state — text or structured JSON — and a set of named questions, it answers every question in one request with a typed answer and a probability distribution: a **Choice** among up to 255 labelled options, a **Score** on a 2–10 level rubric, or a **Boolean** with the probability of yes. It is much faster and much cheaper than a language model for the same decision, and its probabilities are real, so Norish can automate the clear cases and hand only the uncertain ones to the language model — or to a person. It cannot write a provenance note, estimate calories, convert a unit, extract a recipe or draw a dish. It is an addition to the AI provider, never a replacement for it.

## Solution

Norish gains a **Decision Model**: a second, optional AI provider whose only job is to answer closed questions. It is configured on its own, with its own API key, in the AI settings beside the Image Generation block it structurally resembles, and it can be switched on or off without touching the language-model provider. When it is configured, features that have a closed question to ask send it there first; when it is not, every one of them behaves exactly as it does today.

Three rules hold everything together:

1. **A Decision is the AI Runtime's fourth entry point.** `decide` sits beside `generateStructured`, `transcribe` and `generateImage` (ADR-0015, ADR-0024). It is a genuinely different kind of request — no Prompt, no schema, no text out, typed questions in and probabilities back — which is the bar ADR-0024 set for a fourth. It reads its own configuration block, follows the global AI switch, runs on the shared transport under the one AI timeout, logs token usage once, and throws the same typed errors with the same retryability rule. A feature never constructs the provider client or calls the SDK.

2. **The Decision Model is never required.** Every kind that gains a Decision keeps its language-model or heuristic path, and takes it whenever the Decision Model is disabled, unconfigured or fails. Nothing a self-hoster has today stops working because they did not sign up for a second provider, and nothing new breaks when that provider is down. Where a Decision _adds_ a question nobody asked before (is this page a recipe?), an unconfigured Decision Model simply means the question is not asked.

3. **Clear cases are automated, unclear ones are handed on.** Jev's probabilities are the product's, not the model's: each feature owns its threshold in code and says what happens below it — fall back to the language model, keep the current behaviour, or leave the gap for a person. An answer Jev is unsure about is never written to a recipe as if it were sure.

The work is sequenced so that the provider lands before any feature uses it, and features are converted one at a time, each with its fallback, each a ticket a self-hoster can verify in isolation.

## User Stories

### Self-hosters and administrators

1. As a self-hoster, I want to add a TypeSafe API key in the admin AI settings, so that Norish can use Jev without me editing environment files.
2. As a self-hoster, I want the Decision Model to be a separate block from my AI provider, so that switching it on never changes which language model my imports and enrichment use.
3. As a self-hoster, I want to test the key from the settings page, so that a typo is caught before a queue worker discovers it.
4. As a self-hoster, I want every AI feature to keep working exactly as it does today when I have no Decision Model, so that this is an addition and never an upgrade cost.
5. As a self-hoster, I want the global AI switch to turn Decisions off with everything else, so that "AI off" means no request leaves the server.
6. As a self-hoster, I want a Decision to run under the AI timeout I already tuned, so that there is still one number.
7. As a self-hoster, I want token usage for each Decision in my logs beside the language-model usage, so that I can see which feature is responsible for which bill.
8. As a self-hoster on a paid language-model provider, I want enrichment kinds that only need a pick to stop spending generation tokens on it, so that the bulk sweep costs what the decisions cost.
9. As a self-hoster on a slow local model, I want those kinds to finish in well under a second, so that a newly imported recipe is categorised before I have opened it.
10. As an administrator, I want a Decision Model failure to leave a recipe untouched and interrupt nobody, exactly as any other automatic enrichment failure does.
11. As an administrator, I want the docs to say plainly which kinds a Decision Model speeds up and which it cannot touch, so that I know what I am paying for.

### Cooks

12. As a cook, I want my recipes categorised and allergy-tagged as accurately as before, or better, so that a cheaper path costs me nothing.
13. As a cook, I want a recipe the model is unsure how to categorise to be handled the way it is today rather than guessed at, so that a cheap wrong answer never lands on my recipe.
14. As a cook importing a URL that turns out not to be a recipe, I want to be told so quickly instead of waiting for an AI extraction to fail, so that a wrong paste costs me seconds rather than a minute.
15. As a cook, I want Supplied Recipe Data to keep outranking every automatic run, whichever model made the decision.
16. As a cook, I want nothing on the recipe page to change, so that where a decision came from stays invisible.

### Maintainers and contributors

17. As a maintainer, I want a Decision to go through the AI Runtime like every other model request, so that ADR-0015 stays true and there is still exactly one place that talks to a model.
18. As a maintainer, I want a feature's Decision and its fallback to live in the same file, so that reading one function tells me both what is asked and what happens when it cannot be.
19. As a maintainer, I want thresholds to be named constants beside the question that produced them, so that tuning one is a one-line change with a test.
20. As a maintainer, I want the test for a Decision-backed feature to mock the runtime's `decide` and nothing else, so that the tests describe behaviour rather than wiring.
21. As a maintainer, I want the E2E harness to fake the TypeSafe endpoint the way it fakes the OpenAI-compatible one, so that a Decision is a real HTTP round trip under browser tests.
22. As a contributor, I want a glossary entry and an ADR that say what a Decision is and where it may be used, so that the next closed question in the product finds the right tool without a discussion.

## Implementation Decisions

### The provider and the AI SDK line

- Jev is reached through the AI SDK's **TypeSafe provider**, `@ai-sdk/typesafe-ai`, and the SDK's `experimental_evaluate` call. That call exists only in **AI SDK 7**; the provider package depends on `@ai-sdk/provider` 4 (the V4 specification). Norish is on AI SDK 6 (`ai` ^6.0.262, `@ai-sdk/provider` ^3). **The first ticket moves the AI SDK line to 7**, as its own PR with no behaviour change: every provider package Norish uses has a 7-compatible major on npm (`@ai-sdk/openai` 4, `anthropic` 4, `azure` 4, `google` 4, `groq` 4, `mistral` 4, `deepseek` 3, `perplexity` 4, `openai-compatible` 3, `ai-sdk-ollama` 4.3 with peer `ai` ^7.0.95). The temperature-fallback middleware, the structured-output call, transcription and image generation are the four places the move can bite, and the existing runtime tests plus the E2E fake provider are the net.
- **Fallback if the line move stalls.** TypeSafe ships an official zero-dependency client, `@typesafe-ai/sdk` (Node 20+, `POST /v1/systemone`, typed `choice`/`score`/`noul` answers with confidence, retries, per-attempt timeout). ADR-0015 already tolerates raw clients as escape hatches _inside_ the provider boundary (the generic transcription client, the Ollama fetch). If ticket 01 proves to be more than a week of work, `decide` is built on that client in `providers.ts` instead, with an identical signature, and swapped to the AI SDK provider when the line moves. The feature tickets do not care which; the runtime's contract is the same.
- The provider's evaluation API is marked experimental by the SDK. That is accepted and contained: only `runtime.ts` and `providers.ts` import it, so an API change on the SDK side is a two-file change.

### Configuration: the Decision block

- A new server-config block, `decision_config`, sensitive, following the Image Generation block's shape (ADR-0024): `provider` (`disabled` | `typesafe`), `apiKey`, `model` (default `jev-latest`), and an optional `endpoint` (TypeSafe's base URL, default `https://api.typesafe.ai/v1`, exposed for proxies and a future self-hosted or gateway deployment). It ships unconfigured: no row means no Decision Model.
- The provider enum has one real member on purpose. Vercel's AI Gateway also serves Jev; when that is wanted it is a second enum member and a base URL, not a redesign. The enum exists so the admin form reads like the two sibling blocks and so `disabled` is a stored fact rather than an absent key.
- **No fallback to the AI configuration's key.** The sibling blocks borrow the AI provider's endpoint and key when the provider matches; here the provider never matches, so the block always carries its own key. Changing the provider drops the stored key, as the sibling blocks do.
- **No timeout, no temperature, no max tokens.** The one AI timeout governs a Decision (ADR-0015). Jev takes no Generation Preferences, so ADR-0014 has nothing to drop.
- **No environment variables.** The AI, transcription and image blocks are documented as admin-settings configuration, and `.env.example` deliberately points at Settings => Admin for all of them. Seeding from `TYPESAFE_API_KEY` is a possible follow-up, not part of this work.
- The global AI switch gates Decisions: `aiConfig.enabled` false means `decide` throws `AIDisabledError` like every other entry point. A Decision Model configured on a server whose language-model provider is unconfigured or broken still works — the two are independent — but only when AI is switched on.
- **Uses are the administrator's, the algorithm's are not.** The block carries a `uses` list — Auto-categorization, Allergy detection, Recipe Provenance, Grocery linking, Validate enrichments — chosen in **one multi-select** (the same control the automatic enrichment kinds use), **all selected by default** the moment a Decision Model is configured, so enabling Jev enables everything it can do for a household and an administrator deselects what they do not want. One control, not a row of toggles. Import triage (ticket 07) has no switch: it serves Norish's own import algorithm, only ever makes an import cheaper or refuses a page that was never a recipe, and is not a household preference. The loader answers one question, `isDecisionUseEnabled(use)`, which is false whenever no Decision Model is configured.
- **Admin form.** A _Decision Model_ section joins the AI & Processing accordion after Image Generation: provider select, API key (secret input, masked, revealable, preserved when omitted on save), model field defaulting to `jev-latest`, endpoint under an "advanced" disclosure, a **Test** button that issues one trivial Boolean question and reports success or the provider's error, one **Use the Decision Model for** multi-select below the connection fields, and the standard unsaved-changes and dirty-section handling. Translations in all fourteen locales; the i18n gate is the check.

### The runtime's fourth entry point

- `decide({ feature, state, questions })` returns typed answers. `feature` labels the log line and names the caller (it is the same string a Prompt name would be for a kind that has one). `state` is text or a JSON object. `questions` is a record of Choice, Score and Boolean questions with instructions and criteria, typed so a feature's answer keys and choice labels are checked at compile time.
- The result carries, per question, the pick and the full probability distribution, plus TypeSafe's confidence where the provider returns it (`providerMetadata.typesafe.confidence`). The runtime returns it as-is: **thresholds belong to the feature**, never to the runtime and never to configuration. Each feature declares its threshold as a named constant beside the question, with a test at the boundary.
- **A Decision has no Prompt.** This is a deliberate, scoped exception to ADR-0016's "every request starts from an administrator-editable Prompt", and the ADR below records it. A question's criteria labels _are_ the answer schema — the four categories, the household's allergens, the administrator's Cuisines — and they come from the domain, not from text. Its instructions and descriptions are code-owned, exactly as system messages and Zod `.describe()` strings are today. What an administrator tunes in a Prompt is wording; what would be tunable in a Decision is the option set, which the domain already owns. If a real need to tune instructions appears, it is a new ticket, not a reason to interpolate.
- The state a feature sends is the analogue of its Prompt Sections: composed by the feature, structured (JSON) where the recipe is structured, never a finished prose prompt.
- Errors map onto the existing hierarchy: disabled → `AIDisabledError`; missing or invalid block → `AIConfigurationError` (never retries); provider failure → `AIProviderError` with retryability from the SDK's `APICallError` (429 and 5xx retry, 4xx does not); an answer missing a question or failing the distribution check → `AIResponseError` (retries). `toAIError` learns nothing new if the SDK surfaces `APICallError` for this provider as documented.
- Token usage is logged once per Decision with provider, model, feature and the number of questions, matching the structured-generation log line. Not returned, not persisted.
- The runtime's tests gain a `decide` suite mirroring `structured-output.test.ts`; feature tests mock `decide` and their repositories, nothing else.
- The E2E harness's fake AI provider gains a `POST /v1/systemone` route answering TypeSafe's wire shape (`answers[id].{type, choice|score|noul, probabilities, confidence}`, `model`, `usage`), so a Decision under browser tests is a real loopback round trip like every other model call.

### How a feature uses a Decision

A converted kind reads as one function with two branches, in this order:

1. If the Decision Model is configured and the kind's use is on, compose the state, ask, and act on the answer **when it clears the feature's threshold**.
2. Otherwise — not configured, the use switched off, a `decide` failure of any retryability, or an answer below threshold — take the path the kind has today.

The fallback is a call to the same function the kind calls now, not a copy of it; the structured-generation path is neither deleted nor changed by the conversion. A `decide` failure is logged at warn and never surfaces: the kind either succeeds on the fallback or fails the way it fails today. The coordinator, the queue, the lifecycle contract and Supplied Recipe Data precedence are untouched — a Decision changes _how a kind decides_, never _whether it runs_ or _what it may overwrite_.

### What the Decision Model is used for

The inventory below is what the codebase actually decides today with heuristics or with a language model, sorted by fit. "Fit" means the answer space is closed, the input is a stored recipe or a page, and the pick is what matters. Kinds that produce free text (a provenance note, an image brief), numbers (nutrition, unit conversion) or structure (extraction, Step Ingredients) are out of Jev's reach and stay where they are.

**Converted kinds — a language-model request becomes a Decision, with the old path as fallback**

| Kind                                     | Today                                                                                                                                                                                                                             | As a Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Ticket |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Auto-categorization                      | A structured-generation request against a four-value enum the model still ignores, then a fuse.js synonym matcher (`category-matcher.ts`, threshold 0.25, seven locale bundles) to land the words on Breakfast/Lunch/Dinner/Snack | Four Boolean questions on the recipe state, one per category, since a recipe may be several. A category is set when its probability clears the constant; when nothing clears it, the language model is asked as today. The matcher stays for extraction output, which still arrives as words                                                                                                                                                                                                                                                            | 05     |
| Allergy detection                        | The household's allergen list goes in as a Prompt Section, a free-text array comes back, and the code filters it back down to the list. No measure of certainty for the one safety-relevant output in the product                 | One Boolean per household allergen ("does this recipe contain X?"), answered together. Two constants: above the upper bound the allergen is tagged; below the lower bound it is not; anything in between hands the whole recipe to the language model. The list is data already, so nothing moves                                                                                                                                                                                                                                                       | 06     |
| Recipe Provenance — country and Cuisines | One request returns country code, region, Cuisines and a note; Cuisines are then Levenshtein-matched onto the vocabulary (`cuisine-resolver.ts`, 0.85)                                                                            | A Choice over ISO-3166 codes (about 250, inside the 255 limit) and one Boolean per Cuisine in the administrator's vocabulary, under the `existing` strategy only. A clear country and its Cuisines become settled slots the language model writes the region and note around — the shape ADR-0018's gap-fill already has. Under `extend`, or when the country is unclear, the whole group stays with the language model. A manual run replaces the stored group with the composed claim. The win is accuracy and vocabulary discipline rather than cost | 08     |

**New questions — nothing asks these today**

| Question                              | Today                                                                                                                                                                                             | As a Decision                                                                                                                                                                                                                                                                                                                                                             | Ticket |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Is this page a recipe at all?         | `isPageLikelyRecipe`: lowercase the HTML, count hits from an administrator-editable list of ~70 words across nine languages, require two — the gate on whether an AI extraction is attempted      | One Boolean on the sanitized page text, asked only when the structured parser found nothing. A clear "no" refuses the import with the message the parser already has; anything else proceeds to extraction as today. The keyword list stays as the path when no Decision Model is configured                                                                              | 07     |
| Does this caption hold a recipe?      | Five character-count thresholds in the Instagram processor (50, 50, 50, 200, 50) standing in for the question                                                                                     | The same Boolean on the caption, deciding whether to extract from it before paying for a transcription, and whether a photo post is importable at all. Thresholds stay as the fallback                                                                                                                                                                                    | 07     |
| Is the structured parse good enough?  | Success is "has a name"; whether AI runs anyway is one global switch (`alwaysUseAI`)                                                                                                              | A Score (incomplete → usable → complete) on the parsed recipe. Below the constant, AI extraction runs for this page as if `alwaysUseAI` were on; the switch keeps meaning "always", but a server without it stops shipping a title with two ingredients                                                                                                                   | 07     |
| Which offered product is the grocery? | `chooseUnmistakable` auto-links only an exact or near-exact name and deliberately has no threshold (the 0.23.1 tightening); everything else is _offered_ in the grocery panel in the shop's order | A Choice over the candidates plus `none`, asked after the name rule declines. A pick the model is sure of (above `LINK_THRESHOLD`) is **linked** and priced like an unmistakable match; otherwise nothing is linked and the offered list is **ordered** by probability with a marked best guess. Unlinking works as before; the name rule and ADR-0029/0030 are untouched | 09     |

**Enrichment Validation — every enrichment run validates its own output**

| Run                                                                                   | Question                                                               | On a clear "no"                                                                                                                                                                                | Launch mode                                              | Ticket |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------ |
| Auto-tagging, auto-categorization (language-model path), Ingredient Linking, Cuisines | One Boolean per claim                                                  | The claim is not written; doubt keeps it                                                                                                                                                       | enforce                                                  | 10     |
| Nutrition estimation, provenance country                                              | "Is _N_ kcal within reason for this recipe?", "Is this dish from _X_?" | The run fails retryable and asks again, so no half-group is ever written                                                                                                                       | shadow, then enforce once the disagreement rate is known | 10     |
| Allergy detection (language-model path)                                               | "Does this recipe contain _X_?"                                        | The allergen tag is not written, but only under a far stricter constant of its own (presence at or below one in twenty): a spurious allergen tag is a nuisance, a missing one can hurt someone | enforce, strict                                          | 10     |
| Recipe extraction                                                                     | A faithfulness Score                                                   | Logged only until the disagreement rate says whether refusing an import is ever right                                                                                                          | shadow                                                   | 10     |

Validation sits in each kind between the language-model answer and the repository write, and sees **only the claims the run just made**. Nothing in the schema records which stored tags or categories were AI-made, so validating stored data would remove a cook's own tags with the same confidence as the model's; keeping validation on the run's output is what makes "manual data is never removed" true by construction, for every kind, automatic and manual alike. The Validate enrichments use governs enforce; shadow logging is the algorithm's and always runs.

**Considered and not planned** (recorded so the next reader does not redo the survey)

- _Auto-tagging._ Only the `predefined` strategy is a closed set, and that set lives in the administrator's Prompt text, not in data. Converting it means first making the predefined tags a vocabulary, which is its own decision. `predefined_db` and `freeform` are open sets. Revisit after the vocabulary exists.
- _Unclassified Post._ The three-state video-stream union exists because the downloader gave no evidence; a Decision Model has no more evidence than the downloader. Not a judgement call, and #513's fix stands.
- _Enrichment coordination._ Every skip reason and every supplied-data check is a deterministic predicate over stored state. Policy stays policy.
- _Nutrition, unit conversion, the image brief, Ingredient Linking shares, extraction itself._ Numbers, rewritten text, a paragraph, a fraction, a whole recipe. Generation.
- _Ingredient Linking membership._ "Does step N use line M?" is a Boolean grid and Jev could answer it, but the share beside it is a number the language model has to produce anyway, so splitting the request buys nothing.
- _Measurement system, timer `1:30`, recurrence phrases, image-candidate ranking, store-page price reading._ Real heuristics, but each is either client-side, deterministic enough, or a question about pixels and DOM rather than text. Listed in ticket 07's comments as future candidates if Decisions prove cheap enough to ask casually.
- _Validating stored enrichment data, which needs an origin recorded per claim first._ A separate decision; see ticket 10.
- _Duplicate recipes ("same dish?"), ingredient-line headings in flat text._ Genuinely new capabilities Jev is well shaped for. Each needs its own spec; neither is required to prove the Decision Model earns its place.
- _Aisle filing._ Off limits by ADR-0031.

### Vocabulary

Added to `CONTEXT.md` under _Imports & AI_ (ticket 02): **Decision Model**, **Decision**, **Clear Case** (an answer above a feature's threshold), **Decision Use** (one thing the Decision Model does for a household, chosen from one list; import triage is not one), **Enrichment Validation** (the check a run's own output gets before it is written). The _AI Runtime_ entry gains its fourth entry point; the _Prompt_ entry narrows from "every AI request" to "every language-model request" and names the exception.

### Decision record

ADR-0035 — _Decisions are the runtime's fourth entry point, on their own provider_ — records: why a fourth entry point clears ADR-0024's bar; why a Decision has no Prompt (the scoped exception to ADR-0016); why thresholds are code, not configuration; why the Decision Model is never required; and why the AI SDK line moved to 7 for it (with the raw-client escape hatch as the considered option).

### Docs and release notes

Per `docs/agents/feature-docs.md`: the AI provider configuration page gains a _Decision Model_ section (what it is, what it speeds up, what it cannot do, the settings and the uses multi-select, a screenshot of the block, and a mermaid diagram of the runtime's four entry points, the Decision-first branch with its fallback, and the validation step before the write), the Recipe Enrichment page notes which kinds use it and that a run's own claims are validated while a person's are never touched, the grocery pricing page notes the ordered product list, and the Target Version's release notes get a Features entry. The AI SDK line move gets an Upgrade note only if anything a self-hoster configures changes — the intention is that nothing does.

### Sequence

| #   | Ticket                                                                             | Phase                | Status          |
| --- | ---------------------------------------------------------------------------------- | -------------------- | --------------- |
| 01  | The AI SDK line moves to 7                                                         | Prerequisite, own PR | resolved        |
| 02  | Vocabulary and the decision record (ADR-0035)                                      | Foundation           | resolved        |
| 03  | The Decision Model configuration block and its admin form                          | Foundation           | resolved        |
| 04  | The AI Runtime can decide (`decide`, provider, errors, E2E fake, measurements)     | Foundation           | ready-for-human |
| 05  | Auto-categorization asks a Decision first                                          | First conversions    | resolved        |
| 06  | Allergy detection asks a Decision first                                            | First conversions    | resolved        |
| 07  | Import triage: is this a recipe, does this caption hold one, is the parse complete | New questions        | resolved        |
| 08  | Recipe Provenance settles country and Cuisines by Decision                         | Second conversions   | resolved        |
| 09  | A Decision orders the offered products, and links one it is sure of                | Second conversions   | resolved        |
| 10  | Every enrichment run validates its own output                                      | Validation           | resolved        |
| 11  | Docs, screenshots and release notes, with mermaid diagrams of the internals        | Ships last           | ready-for-human |

02–04 land together as one PR after 01; 05 through 10 are each their own PR, 08 after 05, 10 after 05 and 06; 11 rides the last of them. The maintainer confirmed 08 and 09 as good fits on 2026-09-19, asked for 10 as validation of the existing enrichments' output (never of stored data), one multi-select for the uses, the high-probability link in 09, and the diagrams in 11.

## Non-goals

- Replacing the language-model provider. Extraction, nutrition, provenance notes, unit conversion, ingredient linking and image generation are generation and stay generation.
- Guessing an Aisle for a grocery. The grocery-aisles spec says Norish never guesses an Aisle from words, and a Decision Model does not reopen that.
- Exposing thresholds or question wording as settings. Which _uses_ run is a setting; how sure each has to be is not.
- A Decision that writes anything a person or an import source supplied. Precedence rules are unchanged.
- Reaching Jev through Vercel's AI Gateway. It is one enum member away when wanted.
- Persisting token usage or per-decision probabilities. Logged, like every other request.
- Mobile. The app is parked; every change here is server-side or web admin.

## Open questions

- TypeSafe's rate limits, pricing tiers and the maximum number of questions per request are not published anywhere reachable from this environment. Ticket 04 measures them against a real key before the bulk sweep is allowed to run Decisions, and the sweep's confirmation copy may need to mention them.
- Whether the E2E fake should assert TypeSafe's exact 2-decimal rounding contract or only the shape. Shape first; rounding when a test needs it.
