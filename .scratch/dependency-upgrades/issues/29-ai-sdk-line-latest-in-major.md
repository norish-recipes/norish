# 29 — The AI SDK line moves to its latest in-major versions

Status: resolved
Blocked by: 15 (undici 8). Ticket 05 lands in the same commit.
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `ai` and every `@ai-sdk/*` package in `packages/shared-server` to the newest version inside its current major. Ticket 05 moves `@ai-sdk/perplexity` to 5 in the same commit, so the lockfile never holds two `@ai-sdk/provider` copies. There is no `ai` 8 on npm (2026-10-13), so in-major is the latest.

On 2026-10-12 (take the newest when the work starts; `ai` was 7.0.138 on 2026-10-13):

| Package                         | Today   | Latest in-major |
| ------------------------------- | ------- | --------------- |
| `ai`                            | 7.0.107 | 7.0.137         |
| `@ai-sdk/provider` (dev)        | 4.0.17  | 4.0.26          |
| `@ai-sdk/anthropic`             | 4.0.58  | 4.0.78          |
| `@ai-sdk/azure`                 | 4.0.75  | 4.0.99          |
| `@ai-sdk/google`                | 4.0.76  | 4.0.93          |
| `@ai-sdk/groq`                  | 4.0.46  | 4.0.59          |
| `@ai-sdk/mistral`               | 4.0.48  | 4.0.62          |
| `@ai-sdk/openai`                | 4.0.71  | 4.0.91          |
| `@ai-sdk/deepseek`              | 3.0.49  | 3.0.63          |
| `@ai-sdk/openai-compatible`     | 3.0.53  | 3.0.67          |
| `@ai-sdk/typesafe-ai`           | 3.0.4   | 3.0.17          |
| `ai-sdk-ollama`                 | 4.3.0   | 4.4.0           |
| `openai` (transcription client) | 7.5.0   | 7.32.0          |

- **Use one provider version.** Each package pins exact `@ai-sdk/provider` and `provider-utils` versions, so take a set that agrees on one of each. The newest releases on the same day usually do.
- **The `openai` client** is used only by the transcription client in `ai/runtime/providers.ts`.
- **Everything stays inside `ai/runtime/`** (ADR-0015).

## Acceptance criteria

- [x] **One copy.** `pnpm why @ai-sdk/provider @ai-sdk/provider-utils` shows one version of each.
- [x] **Runtime tests pass:**
  - temperature fallback;
  - structured output, including the plain-JSON degrade for OpenAI-compatible endpoints (#538);
  - image generation;
  - transcription.
- [x] **E2E.** The E2E AI project passes.
- [x] **Real-key smoke** (manual): one hosted provider plus the OpenAI-compatible or Ollama path.
- [x] **AI boundary.** An `rg` check shows that no feature file imports `ai` or an `@ai-sdk/*` package.

## Comments

- Filed 2026-10-12, split out of ticket 05 when the maintainer limited 0.25 to safe fixes.
- 2026-10-13 — Joined with ticket 05.
- 2026-10-13 — Done: `ai` 7.0.139; `@ai-sdk/anthropic` 4.0.79, `azure` 4.0.101, `google` 4.0.95, `groq` 4.0.60, `mistral` 4.0.63, `openai` 4.0.93, `deepseek` 3.0.64, `openai-compatible` 3.0.68, `typesafe-ai` 3.0.18, `perplexity` 5.0.11 (ticket 05), `@ai-sdk/provider` (dev) 4.0.27; `ai-sdk-ollama` 4.5.0; `openai` 7.32.0. Every one of them pins `@ai-sdk/provider` 4.0.27 and `provider-utils` 5.0.59, so the lockfile holds one of each.
  - **Tests:** the 346 AI tests pass (temperature fallback, structured output with the plain-JSON degrade, image generation, transcription), and `pnpm typecheck` passes.
  - **Boundary:** no file outside `ai/runtime/` imports `ai`, an `@ai-sdk/*` package, `ai-sdk-ollama` or `openai`.
  - **Not done here:** the real-key smoke.
- 2026-10-13 (review) — The full `pnpm test:e2e` (ai, offline and realtime projects) passed 175 of 175 on this commit, and again on the parser commit after it.
- 2026-10-14 — Real-key smoke ticked by the maintainer (ticket 50).
