# Ticket 01: An OpenAI-compatible Decision Model

Status: ready-for-human

## What to build

1. `packages/config/src/zod/server-config.ts`
   - Put `generic-openai` in `DecisionProviderSchema`.
   - Put `DECISION_PROVIDERS_NEED_ENDPOINT` and
     `decisionProviderNeedsEndpoint` in the module.
   - Put `decisionProviderDefaults` in the module: TypeSafe keeps `jev-latest`
     and its base URL; a generic endpoint has no standard values.
   - `resolveDecisionSettings` reads these standard values.
   - `isDecisionConfigValid` needs a key for both providers, and a model and an
     endpoint for a generic endpoint.
2. `packages/shared-server/src/ai/runtime/endpoints.ts`
   - `normalizeOpenAICompatibleEndpoint` keeps a `/vN` part that an operator writes and puts
     `/v1` only on a URL with no `/vN` part.
3. `packages/shared-server/src/ai/runtime/structured-output.ts`
   - Move `canDegradeToJsonMode` and `jsonModeInstruction` here.
4. `packages/shared-server/src/ai/runtime/decision-model.ts`
   - Build an evaluation model over an OpenAI-compatible chat model.
   - Request one JSON object with a distribution for each question.
   - Retry in JSON mode when the endpoint rejects the schema.
   - Normalize distributions and calculate a choice or a weighted score.
5. `packages/shared-server/src/ai/runtime/providers.ts`
   - Add the `generic-openai` case to `createDecisionModelFromConfig`.
   - Reject a missing key or endpoint.
6. `packages/shared-server/src/ai/runtime/runtime.ts`
   - Use the structured-output functions in their new module.
   - Name the Decision Model provider, not TypeSafe, in the missing-key test
     result.
7. `apps/web/app/(app)/settings/admin/components/decision-model-form.tsx`
   - Add the provider option and its label in each language.
   - Use provider standard values for the model and endpoint.
   - Require an endpoint and a model before Test and Save for a generic
     provider.
   - Show generic help for the key, model and endpoint fields.
8. Translations in each language, release notes and the AI provider docs.

## Acceptance criteria

- The config schema accepts `generic-openai` and rejects an unknown provider.
- A generic block with no key, model or endpoint is not valid.
- `/v1`, `/v4`, `/api/v4` and a trailing slash reach the same URL as a real
  Decision. A URL with no `/vN` part gets `/v1`.
- Test connection and `decide` use one endpoint function.
- Norish sends a strict schema request first. A 400/404/422/501 rejection gets
  one plain-JSON retry with the schema in the system instruction.
- Norish normalizes distributions before the SDK validates them.
- The TypeSafe endpoint and its wire shape do not change.
- The config, provider, runtime and web-form tests pass.
- `@norish/config`, `@norish/shared-server`, `@norish/trpc` and `@norish/web`
  lint and typecheck pass.

## Comments

Norish implements this on the feature branch.
The admin screenshot is not new because the settings UI needs an active
service and a database. ADR-0041 amends ADR-0035. The E2E test adds a generic connection over
loopback, not a full generic Decision enrichment flow. This change does not run E2E.
