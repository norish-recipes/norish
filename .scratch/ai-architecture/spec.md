# AI Architecture: one runtime, one boundary

Status: ready-for-agent

## Problem Statement

Norish's AI code has no boundary. There is a module that looks like an internal AI API — an executor with `execute`, `executeText` and `executeVision` — and **nothing in the repository calls it**, in production or in tests. All ten places that generate structured output import `generateText` from the SDK directly and hand-roll the same forty lines around it: check whether AI is enabled, fetch the models, fetch the Generation Preferences, make the call, check for an empty response, re-validate a shape the schema already guaranteed, assemble token counts nobody reads, catch, and map the error to a code nobody branches on.

The consequences are not stylistic.

**A self-hoster cannot properly tune three of Norish's AI features.** Six prompts are administrator-editable. Auto-categorization and allergy detection have their prompts hardcoded in source, so those two Recipe Enrichment kinds cannot be adjusted at all — and nothing in the admin screen reveals which kinds are tunable and which are not. Image extraction is worse than untunable: it takes the administrator's `recipe-extraction` prompt and performs string surgery on it, swapping one sentence for another. The moment an administrator edits that prompt and the exact sentence disappears, both replacements silently become no-ops, and image imports start telling the model it is reading a webpage while handing it photographs. No error, no warning, just quietly worse extraction — and no hint that editing one prompt degraded a different feature.

**Cloud transcription can hang a worker forever.** Every language-model request goes through a shared transport with a configured timeout. Transcription goes through none of it: it builds its own provider clients inline — a separate OpenAI client, a separate Groq client, a separate Azure client, a raw `openai` package client, and a hand-written `fetch` to Ollama — duplicating endpoint normalization that already exists in the provider factory and inheriting none of its timeout handling. Four of the five transcription providers pass no timeout and no abort signal at all. A hung Whisper request occupies a video-import worker indefinitely.

**A video import with AI disabled bills the self-hoster for guaranteed failure.** The video path is gated only on video parsing being enabled. It downloads the video, pays for a transcription, and only then checks whether AI is enabled — and refuses. The code already half-knows this is wrong: the video processor throws "AI features or video processing is not enabled" while checking only the second half of its own sentence.

**Nothing can depend on the AI features.** `packages/api` depends on both `packages/queue` and `packages/trpc`, which makes it a leaf that neither can import. So unit conversion — a complete AI feature, prompt and all — lives in `shared-server` purely because tRPC needs it, while its six sibling features live in `api` and reach the queue workers through a handler registry that hand-copies eight types across the boundary to avoid the import. Where a piece of AI code lives is a record of which package needed it first, not of what it is.

**And the dead weight is substantial.** 546 lines across six files with zero importers or callers, plus a 115-line result module whose ten-variant error union is read exactly once — to be written into a log line. One prompt-builder branch has been dead since extraction stopped embedding tagging instructions, and nine tests defend it.

## Solution

Every request Norish makes to a model goes through **one runtime**, and everything named `ai` lives in **one place**.

The runtime owns what all ten call sites were each doing for themselves: the enabled check, model selection, Generation Preferences, the model call, token logging, and turning provider failures into typed errors. It exposes two entry points, because Norish makes two genuinely different kinds of request — structured generation and transcription — and pretending otherwise would mean inventing a fake schema for audio. Both are built on one shared transport, so transcription finally inherits the timeout and connection handling that language-model requests have always had.

Features shrink to what only they know: assembling their input, and applying their own domain rules to the result. An empty provenance note is a domain failure and stays in the provenance feature. An empty response from the provider is not, and leaves ten files for one.

**Prompts become administrator-editable by construction.** The runtime will not accept a finished prompt string — it accepts the name of an editable prompt plus the sections the caller wants appended to it. A feature therefore cannot ship a hardcoded prompt, because there is no parameter to pass one through. Auto-categorization and allergy detection get the prompts they were always missing, and image extraction gets its own prompt instead of a mangled copy of another feature's. Sections are appended, never interpolated into placeholders, so an administrator who has already customised a prompt keeps a working prompt across the upgrade.

**The boundary becomes a sentence.** Everything under a directory named `ai/` is AI: the runtime, the prompts, and the seven features whose input is a stored recipe and whose output is a domain claim. Recipe extraction is not one of them — it reads raw HTML, scrapes image candidates out of it, and normalizes through the same JSON-LD normalizer that non-AI structured-data imports use. It is an import-pipeline feature that happens to use AI, so it moves to live with the parser. After this, `api` has no `ai` directory, and a newcomer looking for the AI boundary finds exactly one.

**Failures are thrown, with types that say whether retrying is worth it.** Nine of the ten consumers converted the result union into a throw on the very next line, and in the queue workers throwing *is* the documented protocol. The union goes; typed errors replace it and carry something the union never used despite having the information: whether a failure can succeed on retry. A worker no longer burns three attempts with backoff on AI having been switched off.

## User Stories

### Self-hosters and administrators

1. As a self-hoster, I want to edit the prompt used for auto-categorization, so that I can adjust how my recipes are sorted into meals without forking Norish.
2. As a self-hoster, I want to edit the prompt used for allergy detection, so that I can tune it to the allergies my household actually cares about.
3. As a self-hoster, I want to edit the prompt used for extracting recipes from images, so that I can adapt it to the cookbooks I photograph.
4. As a self-hoster, I want editing one prompt never to change how a different feature behaves, so that tuning extraction does not silently degrade image imports.
5. As a self-hoster, I want every AI feature's prompt to be listed in one place, so that I can tell at a glance what is tunable rather than discovering that two kinds are not.
6. As a self-hoster, I want my customised prompts to keep working after an upgrade that adds new prompt capabilities, so that upgrading is never a reason to re-do my tuning.
7. As a self-hoster, I want a transcription request that hangs to eventually give up, so that one bad request does not take a video-import worker out of service until I restart the server.
8. As a self-hoster running a local Whisper endpoint, I want transcription to honour the same timeout I already configured for my local model, so that I tune one number rather than discovering a second one exists.
9. As a self-hoster, I want a video import to refuse immediately when AI is disabled, so that I am not billed for a transcription that was never going to produce a recipe.
10. As a self-hoster, I want the video processor's error message to describe the check it actually performs, so that I am not sent looking at the wrong setting.
11. As a self-hoster, I want token counts for each model request in my logs, so that I can work out which feature is responsible for my provider bill.
12. As a self-hoster, I want transcription to use the same connection handling as every other model request, so that its behaviour under a flaky network is not a separate mystery.
13. As a self-hoster, I want an AI feature to fail with a message that names what went wrong, so that a misconfigured endpoint is distinguishable from a refused model.
14. As an administrator, I want Recipe Enrichment kinds to behave identically whether or not their prompt has been customised, so that customising is safe.

### Cooks

15. As a cook, I want recipe imports, Recipe Enrichment, and unit conversion to work exactly as they do today, so that a refactor is something I never notice.
16. As a cook, I want Automatic Recipe Enrichment to keep deferring to Supplied Recipe Data, so that nothing I typed is overwritten.
17. As a cook, I want an enrichment failure to stay quiet and leave my recipe untouched, so that a background failure is not my problem.
18. As a cook, I want a manually requested enrichment to still report its failure to me, so that work I asked for does not fail in silence.
19. As a cook, I want Recipe Provenance notes to keep appearing in the language the recipe is written in, so that the note reads alongside the recipe rather than against it.
20. As a cook, I want Cuisines to keep resolving against the administrator's vocabulary, so that no duplicate rows are minted by a refactor.
21. As a cook, I want Ingredient Linking to keep filling only steps that have no Step Ingredients, so that links I attached by hand survive.
22. As a cook importing from images, I want extraction quality to improve rather than regress, so that a prompt that finally says "these are images" reads them better.
23. As a cook, I want a video import to fail fast and clearly when the server cannot complete it, so that I am not left watching a progress indicator for a job that cannot succeed.

### Maintainers and contributors

24. As a maintainer, I want exactly one place where Norish talks to a model, so that a change to provider behaviour is one edit rather than ten.
25. As a maintainer, I want it to be impossible to add an AI feature with a hardcoded prompt, so that the tunability gap cannot reopen.
26. As a maintainer, I want it to be impossible to send images to a text-only model by forgetting a flag, so that the invalid state is unrepresentable rather than merely discouraged.
27. As a maintainer, I want a new AI feature to be a prompt, a schema, an input builder and a domain rule, so that adding one is a small, obvious piece of work.
28. As a maintainer, I want a feature's test to stub one piece of AI wiring rather than four, so that the tests describe behaviour instead of wiring.
29. As a contributor, I want a single sentence to tell me where AI code belongs, so that I do not have to reverse-engineer the dependency graph to place a file.
30. As a contributor, I want no directory named `ai` in `packages/api`, so that "where is the AI code" has one answer.
31. As a maintainer, I want unit conversion to sit beside its sibling features, so that its location stops being an accident of which package needed it first.
32. As a maintainer, I want the queue to import enrichment features directly, so that eight hand-copied types stop needing to be kept in sync by hand.
33. As a maintainer, I want dead code deleted rather than documented, so that the next reader does not spend an afternoon proving an executor has no callers.
34. As a maintainer, I want token usage logged in one place rather than assembled in ten and read in none, so that the plumbing earns its keep.
35. As a maintainer, I want AI failures to carry whether a retry could help, so that the queue stops burning attempts on states that cannot change.
36. As a maintainer, I want provider errors to be classified from the SDK's structured error type rather than by searching error messages for "429", so that classification does not break when a provider rewords a message.
37. As a maintainer, I want the redundant post-call shape checks removed, so that the schema is visibly the single source of truth for response shape.
38. As a maintainer, I want the administrator prompt form to be driven by a table, so that adding a prompt is one entry rather than six hand-written places.
39. As an agent working in this repo, I want the AI boundary to be discoverable from directory names, so that I can find the right seam without reading every file.

## Implementation Decisions

### The runtime

- A single module owns all AI egress. It exposes two entry points: **structured generation** and **transcription**. They are separate because their configuration, gating, provider clients and outputs genuinely differ; forcing them into one signature would require inventing a schema and Generation Preferences for audio.
- The structured entry point takes: the feature identity (which names its prompt and labels its log line), a Zod schema **as a value** rather than a name (Recipe Provenance builds its schema per request from the administrator's current Cuisine vocabulary, per ADR-0012), the caller's composed input sections, and optional images.
- It returns the validated output and **throws on failure**. It does not return a result union.
- **Vision selection is implicit**: the presence of images selects the vision model. There is no separate boolean. The deleted executor carried both and gated on their conjunction, so passing images without the flag silently routed them to the text model and dropped them — an invalid state that will not be reproduced.
- Token usage is logged by the runtime, once, with provider, model and feature. It is not returned, not persisted, and not exposed.
- Generation Preferences continue to be requested and dropped on refusal exactly as ADR-0014 describes. The runtime is where that happens; no feature is aware of it.

### Failure contract

- `AIResult`, `aiSuccess`, `aiError`, `AIErrorCode`, `mapErrorToCode`, `getErrorMessage` and `TokenUsage` are deleted.
- A small typed error hierarchy replaces them, distinguishing at minimum: AI disabled, provider failure, and response validation failure. Each carries the SDK's error as `cause`.
- Errors carry **whether a retry could succeed**. The existing enrichment failure handler uses it to skip retries for states that cannot change between attempts — AI having been disabled being the motivating case.
- Provider errors are classified from the SDK's structured error type, not by substring-matching error messages. Prior art for reading it correctly already exists in the temperature-fallback middleware.
- The one consumer that wants a non-throwing outcome is the URL parser, which falls back to non-AI parsing when AI extraction fails. It uses try/catch.

### Prompts

- The runtime accepts a prompt **name plus appended sections**, never a finished string. This makes "every request starts from an administrator-editable prompt" true by construction rather than by convention.
- **Sections are appended, not interpolated.** Placeholder-based templates were rejected: the prompt filler silently drops a variable whose placeholder is absent, so any self-hoster with an already-customised prompt would have had their content silently omitted on upgrade — presenting as a model regression with no diagnosable cause.
- Three prompts are added to the editable set: **auto-categorization**, **allergy-detection**, and **image-extraction**. This brings the total to nine. All three are additive, so no stored configuration breaks.
- Image extraction stops rewriting the recipe-extraction prompt by string replacement and uses its own prompt.
- The prompts configuration schema gains the three fields as **optional**, matching the established pattern for prompts added after a release — the loader already falls back to the shipped default for any field a stored configuration predates.
- **System messages stay code-owned** and are not configuration. They encode invariants the code depends on: schema-parseable output, and Recipe Provenance's deliberate silence about language (a system message naming a language would override the prompt's inference from the recipe). An administrator's intent is already expressible in the prompt, which is appended after the system message.
- The cargo instruction "Return valid JSON only" is removed from the system messages that carry it. Structured output is enforced by the schema.
- The administrator prompt form becomes **table-driven**. Each prompt is one entry describing its field, label and description, rather than a state hook, a load line, a dirty-check clause, a submit key and a form block written out by hand.

### Where code lives

- The seven features whose input is a stored recipe and whose output is a domain claim — nutrition estimation, auto-tagging, allergy detection, auto-categorization, Recipe Provenance, Ingredient Linking, and unit conversion — move to `shared-server`, alongside the runtime and prompts. They depend only on configuration, the database, and shared contracts.
- **Recipe extraction moves to live with the parser** in `api`. It is coupled to the parser in both directions — it scrapes image candidates from raw HTML and normalizes through the shared JSON-LD normalizer — and is therefore an import-pipeline feature, not an AI feature. Video transcript extraction imports the shared extraction pieces from there, which is a near-identical change to what it already does.
- After the move, **`packages/api` has no `ai` directory**.
- Internal layout under `shared-server`: `ai/runtime/` (the seam, its errors, and provider construction), `ai/prompts/` (loader and the nine defaults), `ai/enrichment/` (the seven features).
- The queue imports the six Recipe Enrichment features directly. Their six handler-registry entries and the eight hand-copied enrichment types in the queue's handler contract are deleted. The two extraction handlers remain registered, honestly, because extraction is genuinely api-layer.
- **No barrel.** Consumers import deep paths, matching the repository's existing idiom and package exports mapping. Both barrels being deleted died of having no importers; adding a new one re-creates the problem.
- `shared-server` will hold real domain features rather than only infrastructure. This is accepted rather than solved by renaming the package: a rename touches every import for a cosmetic gain, and the `runtime` / `enrichment` split inside the directory already tells a reader which is which. The rule is written into `AGENTS.md`.

### Transcription

- Transcription client construction moves into the provider module, beside language-model construction, and both are built on one shared transport.
- The two providers the AI SDK cannot serve — the generic OpenAI-compatible endpoint and Ollama — keep their raw clients, but those escape hatches live **inside** the provider boundary rather than in a feature file. Wrapping them in adapters purely to unify a return type was rejected as buying type symmetry with two shims that do nothing else.
- The three endpoint normalizations currently duplicated between the provider factory and the transcriber — the Azure path suffix, the OpenAI-compatible version suffix, and the Ollama trailing-slash strip — exist once.
- Transcription uses the **existing AI timeout setting**. No new configuration field is added. This follows the established pattern of transcription falling back to the AI configuration for endpoint and API key when its own are unset, and it fixes the current state where four providers have no timeout at all and Ollama has a hardcoded one.

### Video gating

- The video import path checks whether AI is enabled **before dispatching**, so nothing is downloaded and no transcription is billed when the only extraction path is switched off.
- The video processor's error message becomes true.
- This is a behaviour change and needs a line in the Target Version's release notes.

### Deletions

- Six files with no importers or callers: the executor, the guards, the core types, the core barrel, the AI barrel, and the prompts barrel.
- All four guard functions. Two have no callers; the other two are duplicates of the configuration loader's, which is what the real callers already use.
- The dead `embedded` mode of the auto-tagging prompt builder and its option, along with the nine tests defending it.
- The extraction prompt's `additionalContext` option — declared, destructured, branched on, never passed.
- The result module, superseded by typed errors and runtime logging.
- Ten unreachable empty-response branches, and the post-call shape re-checks the schema already guarantees. Domain rules that happen to sit in the same condition are kept — notably that a blank Recipe Provenance note is a failure, which the schema does not enforce.

### Commit sequence

One PR. Prerequisites and cleanups are separate commits within it, in this order:

1. Refuse a video import before downloading when AI is disabled.
2. Cover image import and transcription, before either changes.
3. Delete the unused executor, guards and barrels.
4. Move the enrichment features to `shared-server` and extraction to the parser.
5. Add the AI runtime, with no callers yet.
6. Route every model request through the runtime; delete the result module.
7. Make every prompt administrator-editable.
8. Rewrite the feature tests against the runtime.
9. Documentation, release notes, glossary and ADRs.

The move precedes the runtime so each feature file is edited once rather than twice. The runtime is added before it is adopted so the interesting review — does this shape make sense — is separable from the mechanical one.

## Testing Decisions

A good test here asserts what a user or an operator can observe: what reaches the model, what is stored, what is rendered, and what an administrator's setting changes. It does not assert that a particular function was called, and it does not mock the AI SDK — mocking `generateText` is precisely the coupling that makes the current tests break on any refactor.

**No new seams are introduced.** Three existing ones carry the work, and the runtime becomes the single mock point that replaces today's five.

### Seam 1 — the fake AI provider (highest)

The web app's AI end-to-end harness boots a real server with real workers, real Postgres and real Redis, and fakes only the provider's HTTP endpoint. It never mocks the SDK, so the entire refactor is invisible to it.

- Its 24 existing tests across enrichment, Recipe Provenance, Ingredient Linking and paste import are the regression net. They must pass unchanged at every commit. If they need editing, something has changed that should not have.
- **Image import** is covered here, with **no extension to the harness**: the fake serves the chat-completions path, and a vision request uses that same path with image parts in the message content. The harness already captures outgoing requests, so the assertions are that image extraction sends its own prompt and that editing the recipe-extraction prompt no longer alters it.
- **Prompt editability** is covered here: set a prompt through the administrator surface, run the enrichment, and assert the captured outgoing request carries the edited text. This is the test that proves the tunability gap is closed for auto-categorization and allergy detection.

### Seam 2 — provider construction, package-level

Transcription is tested where it actually changes: client construction. Point each of the five transcription providers at a local HTTP server and assert the request reaches the correct URL in the correct shape, through the shared transport, with the timeout applied.

Prior art is in the same directory — the existing provider-temperature and temperature-fallback tests exercise provider construction at exactly this level.

Deliberately not tested through Seam 1: the fake provider has no audio-transcription route, and driving it end to end requires yt-dlp downloading a real video. A new route plus a network dependency is disproportionate for a client-construction change.

### Seam 3 — import-path decisions, package-level

The video AI-disabled gate is tested by asserting that no download and no transcription occur when AI is disabled. Prior art: the existing import-flow test already mocks the configuration loader and asserts import-path decisions.

### Consolidation

The three feature tests that currently mock five to six modules each are rewritten so that **all of their AI wiring collapses to one mock — the runtime**. Today each of them stubs four separate pieces of that wiring: the SDK, provider construction, the prompt loader, and the configuration loader. Afterwards they stub the runtime.

What remains mocked is only a feature's genuine data dependencies — the Cuisine repository for Recipe Provenance, the tags repository for auto-tagging — because resolving a Cuisine against the administrator's vocabulary is the feature's own domain logic, not AI wiring, and stays with the feature by design.

What the tests assert does not change: what reaches the model, and what survives coming back.

The success criterion is therefore **four AI-wiring mocks to one**, not "one mock in total". A rewritten test that still stubs provider construction or the prompt loader means the runtime is not owning what it should; a rewritten test that stubs a repository is correct.

Prompt-loader fallback behaviour stays a unit test, with prior art in the existing per-prompt tests.

## Out of Scope

- **Persisting token usage.** Logging is added; cost tracking with schema, retention and an admin view is a feature, not a refactor. Logging is its honest prerequisite and does not block it.
- **A separate `packages/ai`.** Rejected because recipe extraction is parser-coupled, so a dedicated package would either drag the parser along or fail to hold extraction.
- **Renaming `shared-server`.** Accepted cost, documented instead.
- **A dedicated transcription timeout setting.** The existing AI timeout is reused. A second setting is real surface area for a case nobody has reported.
- **Administrator-editable system messages.** Rejected: they encode code-level invariants, and breaking one surfaces as a schema validation error with nothing pointing at the cause.
- **Placeholder-based prompt templates.** Rejected for the upgrade hazard described above. Append semantics are kept.
- **Auditing the model-listing module.** Roughly 525 lines powering the admin model dropdown; assumed live and untouched.
- **Changing any Recipe Enrichment policy.** The coordinator's eligibility rules, the supplied-data suppression semantics, the lifecycle contract, and the origin-dependent failure reporting are all unchanged. This spec changes how a model is called, not when or whether.
- **Changing prompt content.** Existing default prompts move without editing. The three new prompts are new text; the removal of "Return valid JSON only" from system messages is the only edit to existing wording.
- **Video transcript extraction relocating out of the video module.** It imports the shared extraction pieces from their new home and otherwise stays put.

## Further Notes

### Glossary

`CONTEXT.md`'s "Imports & AI" section gains **AI Runtime**: the single seam through which Norish issues a model request. A feature never constructs a provider client, never reads Generation Preferences, and never calls the SDK. Terms to avoid: *AI executor* (names the deleted prototype), *AI client* (suggests a per-provider object, which is what the runtime hides).

It should also gain a term for the administrator-editable prompt, distinguishing the editable base from the sections a feature appends to it — the distinction that makes "appended, never interpolated" statable.

### Decision records

Two decisions meet the bar — hard to reverse, surprising without context, and the result of a real trade-off. Numbering continues from the current highest, 0014.

- **One runtime, and where AI code lives.** Why the internal AI API was deleted and rebuilt rather than adopted (it was designed without reference to its callers, which is why it had none); why enrichment features live in `shared-server` while extraction lives with the parser; and why failures are thrown with typed errors instead of returned in a union. Files under `docs/adr/ai/`.
- **Prompts are appended to, never interpolated.** Why placeholder templates were rejected despite being the cleaner contract, and the silent-omission upgrade hazard that decided it. Files under `docs/adr/ai/`.

This work also completes the pattern ADR-0014 established: a declared, re-exported, never-used abstraction is deleted rather than filled in. The executor is the second instance.

### Documentation

Per the feature-docs convention, the PR updates the Target Version's release notes and the docs site. Three items are user-visible:

- three newly editable prompts,
- a video import now refusing early when AI is disabled,
- transcription now timing out.

The AI provider configuration page needs the transcription-timeout behaviour described, noting that it follows the existing AI timeout rather than a new setting.

### Verification notes

- The claim that post-call shape checks are redundant was verified against the installed SDK: the structured-output strategy parses and validates against the schema and throws on either failure, so it never returns an unvalidated object.
- All "zero callers" claims were established by repository-wide search including tests, and the guard functions specifically by confirming that the real callers import the configuration loader's versions instead.
- Adding three prompts costs nine new translation keys across thirteen locales — 117 entries — against the internationalisation gate. This is the largest mechanical cost in the PR and the reason the prompt form becomes table-driven.
