# 05 — Perplexity moves to the Agent API

Status: resolved
Blocked by: None. **Urgent**: the Sonar API that Norish calls was retired on 2026-09-27.
Target release: 0.26.0-beta, in the same commit as ticket 29

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `@ai-sdk/perplexity` from 4.0.48 to the newest **5.0.x**, in the same commit as ticket 29's sweep of the other AI packages, so the lockfile never carries two `@ai-sdk/provider` copies.

**Why it's needed.** The package's own docs, shipped in the 5.0.10 tarball (`docs/70-perplexity.mdx`), say:

> Perplexity supports Sonar Chat Completions only until September 27, 2026.
> […] staying on version 4 does not preserve service after the Sonar shutdown.

**About version 5:**

- **The 4.x line has ended** (last release 4.0.52).
- **5.x is still settling.** 5.0.0 was published on 2026-09-26, with ten patch releases in the two weeks after.
- **It is not an AI SDK 8 package.** It talks to the Agent API (`/v1/agent`) exclusively:
  - Sonar model ids are no longer mapped. Use the presets (`fast`, `low`, `medium`, `high`, `xhigh`) or ids such as `perplexity/sonar`.
  - Image `file` parts become `input_image`.
  - **PDF parts are no longer supported.**

**Changes in Norish:**

- **Model list.** `packages/shared-server/src/ai/providers/listing.ts` lists five Sonar ids. Replace them with the Agent API presets, keeping vision support: image parts still work, as `input_image`.
- **Connection test.** `packages/auth/src/connection-tests.ts`, in `testPerplexityConnection`, posts to `https://api.perplexity.ai/chat/completions` with `model: "sonar"`. Change it to a minimal Agent API request.
- **Stored model ids.** Admins who picked a Sonar model have it stored in their AI configuration.
  - **Decision (2026-10-13):** map old ids where the stored id is turned into a model, so no data migration and no manual step is needed: `sonar` → `fast`, `sonar-pro` → `low`, `sonar-reasoning` and `sonar-reasoning-pro` → `medium`, `sonar-deep-research` → `high`. This is the package docs' own suggestion. Say so in an Upgrade note.
- **PDF input.** Check whether any feature sends PDF parts to the language model. If one does, the Perplexity path has to decline them with a clear error instead of failing inside the SDK.
- **Nothing else changes.** `ai/runtime/providers.ts` and `runtime.ts` (schema output and image file parts) need nothing, so everything stays inside `ai/runtime/` (ADR-0015).

## Acceptance criteria

- [x] **Versions.** `@ai-sdk/perplexity` is on 5.0.x, and `pnpm why @ai-sdk/provider` shows one copy (with ticket 29).
- [x] **Model list.** The model picker shows the Agent API presets.
- [x] **Real-key checks** (manual; the sandbox has no key):
  - the connection test succeeds;
  - a URL import (structured output) works;
  - an image-based import (vision) works.
- [x] **Stored ids.** Stored Sonar ids are mapped, with a unit test for the mapping.
- [x] **Existing tests.** The runtime tests pass (temperature fallback, structured output, image generation, transcription), as does the E2E AI project.
- [x] **Type check.** `pnpm typecheck` passes.
- [x] **AI boundary.** An `rg` check shows that no feature file imports `ai` or an `@ai-sdk/*` package.
- [x] **Release notes.** A bullet under `## Fixes and Improvements` ("Perplexity now uses Perplexity's Agent API; the retired Sonar API stopped working on September 27"), plus an `## Upgrade notes` entry on the model names and what happened to stored choices.

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-12 — Narrowed for the safe-fixes-only 0.25: only the Perplexity package moves; the AI SDK sweep is ticket 29.
- Sources:
  - the @ai-sdk/perplexity 4.0.48 and 5.0.10 tarballs (docs and CHANGELOG);
  - `npm view` for the pinned provider versions;
  - search summaries of Perplexity's "Sonar moving to Agents API" notice (the page itself was unreachable).
- Confirm the shutdown with a real key before writing the release note. If Sonar still answers, the urgency drops, but the move is still required.
- 2026-10-13 — Did not ship in 0.25. Moved to 0.26 and joined with ticket 29; the maintainer chose the automatic model mapping (no manual steps for self-hosters).
- 2026-10-13 — Done with ticket 29, on `@ai-sdk/perplexity` 5.0.11:
  - **Model list:** the five Agent API presets (`fast`, `low`, `medium`, `high`, `xhigh`), all with vision.
  - **Stored ids:** a Sonar id is mapped where it becomes a model (`providers.ts`), with the package docs' table. `perplexity-models.test.ts` covers all five, and a preset or `perplexity/…` id passes through unchanged.
  - **Connection test:** posts `{ preset: "fast", input: [one user message], max_output_tokens: 16 }` to `https://api.perplexity.ai/v1/agent`; a 401 still reads as an invalid key.
  - **PDF:** no feature sends PDF parts; the runtime's only file parts are the image import's images (JPEG, PNG, WebP, AVIF), which v5 turns into `input_image`. Nothing to decline.
  - **Release notes:** a Fixes line and an Upgrade note on the presets and the mapping.
  - **Not done here:** the real-key checks (connection test, URL import, image import) need a Perplexity key; the sandbox has none. The release note says Sonar was retired on September 27 on the package docs' word, without a live check.
- 2026-10-14 — Real-key checks ticked by the maintainer (ticket 50).
- 2026-10-14 (review fixes) — The Stored ids mapping is gone: the maintainer made a stored Sonar model a breaking change with an Upgrade note (ticket 37).
