# A language model can make a Decision with estimated probabilities

ADR-0035 states that no language-model provider can make a Decision. That is not true now. This ADR amends ADR-0035.

## Context

ADR-0035 put `decide` on TypeSafe's Jev. Jev returns a probability distribution for each question, and the record calls those probabilities real. Some self-hosters run an OpenAI-compatible model service. They cannot use the Decision Model with only a TypeSafe key.

## Decision

`DecisionProviderSchema` gains `generic-openai`. The provider factory builds an OpenAI-compatible chat model. A small adapter gives a result for the AI SDK evaluation contract:

- It sends one JSON object request with a distribution for each question.
- It uses the JSON schema with `strict: true` first, and the plain JSON fallback second.
- It normalizes each distribution to sum to 1.
- It calculates a choice or a weighted score.

TypeSafe's Jev is the first choice. The Decision block keeps its key, model and endpoint. A generic endpoint must supply all three.

## Consequences

- A Decision from a generic endpoint carries estimated probabilities. They are not calibrated model outputs. Each feature still applies its threshold.
- A generic endpoint can fail more often than Jev. The language-model or heuristic fallback stays in place.
- The adapter is in `ai/runtime/decision-model.ts`. The structured-output functions are used by the AI configuration and the Decision adapter.
- The E2E harness tests a generic connection over loopback. It does not run a full generic Decision flow. The unit loopback tests cover the provider.
