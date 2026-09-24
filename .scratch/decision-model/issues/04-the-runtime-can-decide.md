# 04 — The AI Runtime can decide

Status: ready-for-human
Blocked by: 01, 03

Spec: `.scratch/decision-model/spec.md`
Decision record: ADR-0035 (ticket 02)

## What to build

`decide` becomes the AI Runtime's fourth entry point, beside `generateStructured`, `transcribe` and `generateImage`. A feature hands it a state and typed questions and gets typed answers with probabilities, or one of the existing `AIError`s. Nothing outside `ai/runtime/` imports the TypeSafe provider or the SDK's evaluate call. No feature uses it yet.

## Notes

**Signature** (in `runtime.ts`):

```ts
export interface DecideOptions<Q extends DecisionQuestions> {
  /** Labels the log line and names the caller; no Prompt is loaded. */
  feature: string;
  /** Text or a JSON object — the feature's composed input, structured where the recipe is. */
  state: string | Record<string, unknown>;
  questions: Q;
}
export async function decide<Q extends DecisionQuestions>(
  options: DecideOptions<Q>,
): Promise<DecisionResult<Q>>;
```

`DecisionQuestions` is the runtime's own type (Choice with a `criteria` record of label → description | null, Score with a 2–10 tuple of level descriptions, Boolean with optional instructions), so a feature's answer keys and choice labels are checked at compile time and the SDK's type never leaks past the runtime. `DecisionResult` carries, per question, the pick (`choice` / `score` / `probability`), the full `probabilities`, and `confidence` where the provider reports it (`providerMetadata.typesafe.confidence[id]`). **No thresholding in the runtime.**

**Provider construction** in `providers.ts`: `createDecisionModelFromConfig({ provider, model, endpoint, apiKey, timeoutMs })` returning `{ model: evaluationModel, providerName: "TypeSafe AI" }`, built with `createTypeSafeAi({ apiKey, baseURL, fetch: customFetch })` on the shared transport (`createFetchWithTimeout`). Only `typesafe` is constructible; the enum keeps `disabled` out.

**The call**: `experimental_evaluate({ model, state, questions, abortSignal: AbortSignal.timeout(aiConfig.timeoutMs), maxRetries: 0 })` — like image generation, the SDK's silent in-call retries are off so the queue's attempts are the one retry budget. Validate that every asked question is answered; a missing one is `AIResponseError` (retryable).

**Gating, in order**: `aiConfig.enabled` false → `AIDisabledError`; block missing / `disabled` / no key → `AIConfigurationError("No Decision Model is configured. Set one in the admin settings.")` (never retries); provider failure → `toAIError` (429/5xx retry, other 4xx do not — confirm the SDK raises `APICallError` for this provider as its docs claim, and extend `errors.ts` only if it does not).

**Logging**: one `info` line per Decision — `feature`, `provider`, `model` (the resolved id from the response, e.g. the version behind `jev-latest`), `questions` (count), `inputTokens`, `outputTokens`. Debug line before the request with the question ids. Never log the state at info.

**Escape-hatch route** (only if ticket 01 stalled, see its comments): the same `decide` signature built on `@typesafe-ai/sdk`'s `TypeSafeClient.systemOne` inside `providers.ts`, mapping `noul` → boolean probability and the SDK's `APIError` subclasses onto `toAIError` (429 `RateLimitError` and `InternalServerError` retry; `AuthenticationError`, `BadRequestError`, `UnprocessableEntityError` do not). The client's own retries are set to `maxRetries: 0` for the same reason as above.

**Tests**: `packages/shared-server/__tests__/ai/runtime/decide.test.ts` mirroring `structured-output.test.ts` — disabled, unconfigured, happy path with the three question shapes, missing answer, provider 401 vs 429 retryability, timeout, and the log line's fields. Fake the provider at the fetch boundary, as the existing suites do.

**E2E harness**: `apps/web/__tests__/e2e/harness/ai-provider.ts` gains `POST /v1/systemone` answering TypeSafe's wire shape:

```json
{
  "model": "jev-2026-09-01",
  "answers": {
    "<id>": {
      "type": "choice",
      "choice": "dinner",
      "confidence": 0.91,
      "probabilities": { "breakfast": 0.02, "dinner": 0.9, "...": 0 }
    },
    "<id2>": { "type": "noul", "noul": 0.97 }
  },
  "usage": { "input_tokens": 120, "output_tokens": 0 }
}
```

driven through `AIProviderControl` with a `decision` directive beside `success` and `error`, so a later E2E can queue one Decision answer and one language-model answer for the same recipe. The server under test is pointed at it through the Decision block's `endpoint`.

**Measure before the sweep uses it**: with a real key, record in the comments the observed latency of a 4-question Decision on a 30-ingredient recipe, the rate limit headers TypeSafe returns, and whether a request with ~40 Boolean questions (the allergen and predefined-tag shapes) is accepted. Ticket 05+ read those numbers.

## Acceptance criteria

- [x] `decide` exists in `runtime.ts` with the typed signature above; `rg "typesafe-ai|experimental_evaluate"` hits only `ai/runtime/`.
- [x] Disabled AI, an unconfigured block and a bad key each throw the documented error class with the documented retryability.
- [x] A Choice, a Score and a Boolean question round-trip with their full distributions and confidence.
- [x] A missing answer is `AIResponseError`; a 429 is retryable; a 401 is not.
- [x] The request runs under the AI timeout on the shared transport with SDK retries off.
- [x] One info log line per Decision with the fields above; the state never appears at info.
- [x] The E2E fake serves `/v1/systemone` and a harness unit test covers the directive.
- [ ] The measurements are recorded in the comments.
- [x] ADR-0035 and the glossary match what shipped.
- [x] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Any feature calling `decide`. Tickets 05+.
- Thresholds, caching of answers, or persisting distributions.

## Comments

- Filed 2026-09-19 with the spec.
- 2026-09-19 — Implemented on the AI SDK provider route (ticket 01 did not stall). `decide<Q>({ feature, state, questions })` in `runtime.ts` with the runtime's own `DecisionQuestions`/`DecisionAnswer`/`DecisionResult` types (Choice labels and answer keys checked at compile time; `const` generic so inline question objects keep their literal keys); `createDecisionModelFromConfig` in `providers.ts` on `createTypeSafeAi({ apiKey, baseURL, fetch })` over the shared transport; `experimental_evaluate` with `maxRetries: 0` under `AbortSignal.timeout(aiConfig.timeoutMs)`. `rg "typesafe-ai|experimental_evaluate" packages apps --glob '!node_modules'` hits only `ai/runtime/` plus the E2E harness. Gating: AI off → `AIDisabledError`; no block / disabled / no key → `AIConfigurationError` ("No Decision Model is configured…"); provider failures → `toAIError` (the provider raises `APICallError` as documented, so 401 does not retry and 429 does); a missing answer or a distribution that does not add up arrives as the SDK's `InvalidResponseDataError`, which `errors.ts` now maps to `AIResponseError` (the one extension). One info line per Decision with feature, provider, resolved model id, question count, input and output tokens; the state is logged nowhere. Also `testDecisionModel(config)` for the admin Test button (explicit settings, one Boolean, a credential rejection phrased as such). Tests: `__tests__/ai/runtime/decide.test.ts` (15 cases against a local fake speaking TypeSafe's wire shape). E2E: the fake provider serves `POST …/v1/systemone` from a `decision` lane (`decideWith`, `enqueueDecision`, `failDecisionPermanently` = 401, `failDecisionRetryably`, `decisionRequestCount`) and `ai-provider.test.ts` drives it through the real `@ai-sdk/typesafe-ai` client (5 cases).
- 2026-09-19 — **Not done: the measurements.** Recording the latency of a 4-question Decision on a 30-ingredient recipe, TypeSafe's rate-limit headers, and whether a ~40-Boolean request is accepted needs a real TypeSafe key, which this environment does not have. Left `ready-for-human` for that one box; everything else on the list is checked. Ticket 05 shipped without those numbers on the strength of the spec's rule that the Decision Model is never required and ships unconfigured, so nobody pays for a Decision until an administrator stores a key.
- 2026-09-20 — Review fix. The "real loopback under browser tests" promise was met only at the harness unit-test level; `apps/web/__tests__/e2e/ai/decision-model.e2e.ts` now seeds a Decision block through the real `admin.updateDecisionConfig` mutation, pointed at the fake provider's TypeSafe route, and proves three things in the browser with the queue workers, repositories and realtime all in the path: a clear Decision settles automatic categorization and the AI provider serves only the extraction; an unsure one hands the kind to the AI provider, whose answer the Decision Model then checks; and a disabled block asks no Decision at all. The fake's Decision lane now answers only the question ids a request asked, since the SDK refuses extras, so one persistent answer set serves triage, the extraction's shadow score, the kind and validation at whatever point each is asked (`ai-provider.test.ts` pins it). Still left for a person: the measurements above.
- 2026-09-21 — The runtime now also records every request on a per-job model-use ledger (`ai/runtime/model-use-ledger.ts`): `decide` records `typesafe` with the resolved model id on success and the configured id on failure; `generateStructured`, `transcribe` and `generateImage` record their provider key and model likewise, one entry per logical request whichever request shape answered. The queue's lazy worker manager wraps every processor in `createModelLedgerProcessor`, which writes the ledger onto the job's current attempt (`JobAttemptTimeline.models`) when the processor settles, and `admin.jobs.detail` lists the latest attempt's models once each with failures marked, which the job detail modal shows as chips under **Models**. Tests: `model-use-ledger.test.ts`, one ledger case per entry-point suite, `model-ledger-processor.test.ts`, `lazy-worker-model-ledger.test.ts`, and three router cases. The measurements against a real key are still the one open box.
