# 10 — Ollama as an Image Generation provider

Status: needs-triage
Blocked by: None

Spec: `.scratch/image-generation/spec.md`

## What to build

ADR-0024 lists Ollama among the providers that expose no image model, which is why Image Generation reads its own provider block and why `ImageGenerationProviderSchema` leaves Ollama out. The re-check the ADR asked for when the AI SDK line moved (`.scratch/decision-model/issues/01-ai-sdk-line-moves-to-7.md`) found that this is no longer true: `ai-sdk-ollama` exposes `ollama.imageModel(modelId)` (an `OllamaImageModel` for Ollama's experimental image models such as `x/z-image-turbo` and `x/flux2-klein`, taking `steps` and `negative_prompt` as provider options), added in its 3.8.0 and carried into the 4.x line Norish now depends on.

Decide whether Ollama joins the Image Generation provider enum, and if so add it the way the existing providers are added: the enum and `IMAGE_GENERATION_PROVIDERS_ENABLED` in `packages/config/src/zod/server-config.ts`, a case in `createImageModelFromConfig` in `packages/shared-server/src/ai/runtime/providers.ts` with the landscape shape Ollama's image models accept, the endpoint and key fallback to the AI configuration when the provider matches (ADR-0024), the admin form's provider select, the fourteen locales, `image-generation.test.ts` coverage, the docs page and a release-notes line. Update the ADR-0024 note and the enum's comment either way, so the next re-check starts from a true statement.

## Acceptance criteria

- [ ] A decision is recorded: Ollama is, or deliberately is not, an Image Generation provider, with the reason.
- [ ] If added: a self-hoster running Ollama with an image model can select it in Settings => Admin => AI & Processing => Image Generation and generate a recipe image through it.
- [ ] The comment on `ImageGenerationProviderSchema` and ADR-0024's provider list say what is true of the installed packages.
- [ ] Repo gates green.

## Non-goals

- Anything on the AI SDK line move itself; that shipped with the decision-model ticket 01.

## Comments

- Filed 2026-09-19 from the ADR-0024 re-check in the AI SDK 7 move.
