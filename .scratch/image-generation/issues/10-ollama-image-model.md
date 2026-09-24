# 10 — Ollama as an Image Generation provider

Status: resolved
Blocked by: None

Spec: `.scratch/image-generation/spec.md`

## What to build

ADR-0024 lists Ollama among the providers that expose no image model, which is why Image Generation reads its own provider block and why `ImageGenerationProviderSchema` leaves Ollama out. The re-check the ADR asked for when the AI SDK line moved (`.scratch/decision-model/issues/01-ai-sdk-line-moves-to-7.md`) found that this is no longer true: `ai-sdk-ollama` exposes `ollama.imageModel(modelId)` (an `OllamaImageModel` for Ollama's experimental image models such as `x/z-image-turbo` and `x/flux2-klein`, taking `steps` and `negative_prompt` as provider options), added in its 3.8.0 and carried into the 4.x line Norish now depends on.

Decide whether Ollama joins the Image Generation provider enum, and if so add it the way the existing providers are added: the enum and `IMAGE_GENERATION_PROVIDERS_ENABLED` in `packages/config/src/zod/server-config.ts`, a case in `createImageModelFromConfig` in `packages/shared-server/src/ai/runtime/providers.ts` with the landscape shape Ollama's image models accept, the endpoint and key fallback to the AI configuration when the provider matches (ADR-0024), the admin form's provider select, the fourteen locales, `image-generation.test.ts` coverage, the docs page and a release-notes line. Update the ADR-0024 note and the enum's comment either way, so the next re-check starts from a true statement.

## Acceptance criteria

- [x] A decision is recorded: Ollama is, or deliberately is not, an Image Generation provider, with the reason.
- [x] If added: a self-hoster running Ollama with an image model can select it in Settings => Admin => AI & Processing => Image Generation and generate a recipe image through it.
- [x] The comment on `ImageGenerationProviderSchema` and ADR-0024's provider list say what is true of the installed packages.
- [x] Repo gates green (config and shared-server AI suites, typecheck for config, shared-server and web, the locale key check, docs format and build).

## Non-goals

- Anything on the AI SDK line move itself; that shipped with the decision-model ticket 01.

## Comments

- Filed 2026-09-19 from the ADR-0024 re-check in the AI SDK 7 move.
- 2026-09-19: **Added.** The maintainer asked for it as the follow-up to the line move. Ollama joins `ImageGenerationProviderSchema`, `IMAGE_GENERATION_PROVIDERS_ENABLED` and the endpoint-needing set; `createImageModelFromConfig` builds `createOllama({ baseURL, fetch }).imageModel(model)` and asks for `1280x720`, which the provider sends as `width`/`height` to `POST {endpoint}/api/generate`; the admin form offers it with the `http://localhost:11434` placeholder; the label exists in all fourteen locales; the config tests move Ollama from the refused list to the accepted one and cover the endpoint rule and the matching-provider endpoint borrow; the runtime test drives a real HTTP round trip on the native route. ADR-0024 carries a dated amendment and the docs page names Ollama. Release notes: the `0.24.0-beta` checkpoint was made on this branch (`pnpm docs_update 0.24.0-beta`, freezing `0.23.1-beta` as it shipped, this page's Ollama paragraph restored to the pre-change text in the frozen copy) and `release-notes/0.24.0-beta.md` carries the entry under Fixes and Improvements.
