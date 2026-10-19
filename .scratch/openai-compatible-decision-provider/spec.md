# An OpenAI-compatible Decision Model

Status: ready-for-human

## Problem Statement

The Decision Model has one provider: TypeSafe AI's Jev. A self-hoster who runs
an OpenAI-compatible model service cannot use the Decision Model. That person
must use a TypeSafe key, or accept the language-model fallback for each
Decision use.

The codebase has one endpoint function for the AI provider and its connection
test: `normalizeOpenAICompatibleEndpoint` keeps a `/vN` part that an
operator types. The Decision Model must use the same function. Two
functions cause a connection test and a real request to use different URLs.

## Solution

Add `generic-openai` to `DecisionProviderSchema`. The provider factory uses
`createOpenAICompatible` with the normalized endpoint, the stored API key and
model, and the fetch with a timeout. A missing key or endpoint gives a
clear error.

A small adapter gives a result for the AI SDK evaluation contract with a chat model. The
adapter requests one JSON object with a probability distribution for each
question. It uses the same structured-output mechanism as the AI configuration:
a JSON schema with `strict: true` first, and one plain JSON retry for an endpoint that
rejects the schema. It normalizes each distribution because the numbers from a language model
do not sum to 1.

The admin form gets the provider, with endpoint, model and key fields for the
provider in the form, and a Test control. The Test control uses the same factory and
the same endpoint normalization.

## User Stories

1. As a self-hoster, I must point the Decision Model at my OpenAI-compatible
   service, so that I do not need a TypeSafe key.
2. As a self-hoster, I must keep the `/v4` or `/api/v4` part of my endpoint as it is in the form, so
   that `/v4` and `/api/v4` work and Norish does not write `/v1` into them.
3. As a self-hoster, I must get `/v1` when my endpoint has no `/vN` part, so that the
   usual OpenAI-compatible URL works.
4. As an administrator, I must see the same URL in the Test control and in a
   real Decision, so that a successful test shows the real URL.
5. As an administrator, I must see a missing key or endpoint before Norish
   sends a request, so that an error in the key is easy to find.
6. As an administrator, I must keep the TypeSafe provider as it is, so that
   this addition does not change my configuration.
7. As a maintainer, I must have one version-segment function for the AI
   provider, the Decision provider and both connection tests.
8. As a maintainer, I must use `canDegradeToJsonMode` and the schema
   instruction for the JSON-mode fallback, so that there is one fallback
   mechanism.

## Implementation Decisions

- `generic-openai` is the provider value. It is the same value as in the AI,
  transcription and image provider sets.
- TypeSafe keeps its standard values: model `jev-latest` and endpoint
  `https://api.typesafe.ai/v1`. A generic endpoint has no standard values; the
  administrator writes the model and the endpoint.
- `isDecisionConfigValid` needs a key for both providers, and a model and an
  endpoint for a generic endpoint.
- The evaluation adapter is in `ai/runtime/decision-model.ts`. The provider
  factory is still the one place that makes a client.
- The structured-output functions are in `ai/runtime/structured-output.ts`,
  so the AI configuration and the Decision adapter use one
  `canDegradeToJsonMode` and one `jsonModeInstruction`.
- Norish adds no environment variables. The block is in the database, as the
  AI, image and transcription blocks are.

## ADR amendment

**ADR-0041 amends ADR-0035.** ADR-0035 states that no language-model provider
can give a result for a Decision. A chat model can give a result for the evaluation contract when
Norish requests a distribution for each question. ADR-0041 records the change:
a generic endpoint gives estimated probabilities, the adapter normalizes the
distribution, each feature keeps its threshold, and Jev stays the first
choice.

## Testing Decisions

- `packages/config/__tests__/config/decision-config.test.ts` covers the schema,
  the provider standard values and validity.
- `packages/shared-server/__tests__/ai/runtime/decision-provider.test.ts` starts
  a loopback OpenAI-compatible service. It shows `/v1`, `/v4`, `/api/v4`, a
  trailing slash, and a URL with no `/vN` part. It shows that the connection test
  uses the same URL, the missing-key error, the schema request with `strict: true`, the
  JSON-mode retry, and distribution normalization.
- `apps/web/__tests__/app/settings/admin/decision-model-form.test.tsx` covers
  the generic block in the admin form.
- `apps/web/__tests__/e2e/ai/decision-model.e2e.ts` adds a generic endpoint
  connection test over the harness loopback. This change does not run E2E. The test does not run a full generic Decision
  enrichment flow; the unit loopback tests cover the provider.

## Out of Scope

- Model listing for a generic Decision endpoint. The administrator writes the
  model name.
- A change to the TypeSafe provider or its wire shape.
- A screenshot of the new admin form. The settings UI needs an active service and a
  database; the docs keep the present screenshot.
