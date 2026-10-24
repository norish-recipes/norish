# 37 — A stored Sonar model is migrated once

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, tickets 05 and 29. Found in the branch review on 2026-10-13.

## What to build

`RETIRED_SONAR_MODELS` in `packages/shared-server/src/ai/runtime/providers.ts:75` maps the retired Sonar ids to Agent API presets on every call. This causes two problems:

- The stored setting keeps the old id forever.
- The admin model list (`packages/shared-server/src/ai/providers/listing.ts`) no longer offers Sonar, so the form shows `sonar` while `fast` is the model that actually runs.

**The fix:**

1. Add a one-time startup step beside the other backfills in `packages/api/src/startup/`. It rewrites a stored Sonar id to its preset.
2. The AI config is stored encrypted, so the step goes through the config repository, not raw SQL.
3. Delete `RETIRED_SONAR_MODELS` and `perplexityModelId`.

## Acceptance criteria

- [x] ~~After a boot, a config stored with `sonar-pro` reads `low`. A second boot changes nothing.~~ Reversed: `RETIRED_SONAR_MODELS` and its boot migration are deleted.
- [x] `providers.ts` names no Sonar model.
- [x] The 0.26.0-beta release notes say that a stored Sonar model no longer works and to pick a preset.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 (implemented) — The boot already normalises every stored config through the repository (`normalizeExistingConfigs` → `normalizeAndBackfillConfig`, which decrypts, runs the key's migration and schema, and writes back through `setConfig` only when the value changed). So the step is an `AI_CONFIG` entry in `SERVER_CONFIG_MIGRATIONS` (`packages/config/src/zod/server-config.ts`), beside the units migration, rather than a separate file in `packages/api/src/startup/`: a Perplexity config's `model` and `visionModel` move from a Sonar id to its preset, and any other provider's are left alone. `RETIRED_SONAR_MODELS` and `perplexityModelId` are gone from `providers.ts`, and with them `perplexity-models.test.ts`.
  - `server-config-normalization.test.ts` stores an encrypted Perplexity config with `sonar-pro` / `sonar`: the first pass reports a change and reads `low` / `fast` with the key intact, the second reports none. A `generic-openai` config naming `sonar` keeps it. `ai-config.test.ts` covers the whole table through `normalizeConfigValue`.
  - The release notes' Upgrade note now says a stored Sonar model is moved to its preset when Norish first starts after the upgrade.
- 2026-10-14 (review fixes) — Reversed by the maintainer: a stored Sonar model is a breaking change, not a migration. The table, its boot migration and their tests are deleted, and the Upgrade note now says to pick a preset in the AI settings.
