# 02 — Vocabulary and the decision record

Status: ready-for-agent
Blocked by: None — can start immediately (lands in the same PR as 03/04)

Spec: `.scratch/decision-model/spec.md`

## What to build

The words and the decision, written down before the code that relies on them.

**Glossary (`CONTEXT.md`, _Imports & AI_):**

- **Decision Model** — the optional second AI provider that answers closed questions and generates nothing: TypeSafe's Jev today. Configured on its own with its own key; follows the global AI switch; never required by any feature. _Avoid_: Decision provider (names the settings block, not the thing), Classifier (it also scores and ranks), Jev (a product name; the glossary names the role).
- **Decision** — one request to the Decision Model: a state plus named Choice, Score and Boolean questions, answered together with a probability for every option. The AI Runtime's fourth entry point. It has no Prompt; its criteria come from the domain and its instructions are code-owned. _Avoid_: Evaluation (the SDK's word; it reads as judging quality), Classification (only one of the three question shapes).
- **Clear Case** — a Decision answer above the asking feature's threshold, and therefore acted on. Anything below is handed to the path the feature had before: the language model, the heuristic, or a person. _Avoid_: Confident answer (TypeSafe's confidence is a separate statistic from the probability the threshold reads).

The **AI Runtime** entry gains the fourth entry point and says a Decision reads its own block. The **Prompt** entry narrows: "every language-model request starts from" one, and names the Decision as the request shape that has none.

**ADR-0035** — `docs/adr/ai/0035-decisions-are-the-runtimes-fourth-entry-point.md`, in the established ADR voice (see ADR-0024 for the shape), recording:

- The fourth entry point, and why it clears the bar ADR-0024 set: no Prompt, no schema, no text out, typed questions in and distributions back is a different kind of request, not a different feature making a kind that exists.
- Its own provider block, following the Image Generation shape, with no key fallback because the provider never matches.
- **A Decision has no Prompt** — the scoped exception to ADR-0016 and its reasoning (criteria labels are the schema and belong to the domain; instructions are system-message-like invariants).
- **Thresholds are code, not configuration** — named constants beside the question, with tests; ADR-0014's spirit (don't expose knobs Norish can't explain).
- **The Decision Model is never required** — every converted kind keeps its fallback; a `decide` failure is a warn log and a fallback, never a feature failure.
- The AI SDK line moving to 7 for it, with the official `@typesafe-ai/sdk` raw client inside the provider boundary as the considered-and-kept-in-reserve option.
- Considered options: one more member in the AI provider enum (rejected: Jev cannot serve a single structured-generation request, so "provider" would mean two things); a `decisionModel` field beside `model` (rejected: it is a different vendor with its own key, not a second model of the same one); a separate `packages/decisions` (rejected for the reason ADR-0015 rejected `packages/ai`).

Add ADR-0035 to `docs/adr/index.html` beside ADR-0024.

## Acceptance criteria

- [ ] The three glossary entries exist with _Avoid_ lines, and the AI Runtime and Prompt entries are updated.
- [ ] ADR-0035 exists with the six points above and the considered options, numbered by scanning all of `docs/adr/**` for the highest id.
- [ ] `docs/adr/index.html` links it.
- [ ] The docs format check passes.

## Comments

- Filed 2026-09-19 with the spec.
