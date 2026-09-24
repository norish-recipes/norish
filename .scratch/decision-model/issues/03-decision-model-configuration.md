# 03 — The Decision Model configuration block and its admin form

Status: resolved
Blocked by: 02 (words first; can be developed in parallel and land together)

Spec: `.scratch/decision-model/spec.md`

## What to build

An administrator can point Norish at TypeSafe AI from the admin AI settings: a new **Decision Model** block holding provider, API key, model and an optional endpoint, with a **Test** button. Nothing asks a Decision yet — ticket 04 teaches the runtime, tickets 05+ wire kinds to it.

## Notes

Follow the Image Generation block end to end (`.scratch/image-generation/issues/01-*` records how it was done, commit `5924e271`): a `ServerConfigKeys.DECISION_CONFIG = "decision_config"` key, **sensitive**, so `apiKey` rides the shared merge/mask and an omitted key on save preserves the stored one.

Schema, in `packages/config/src/zod/server-config.ts`:

```
DecisionProviderSchema = z.enum(["typesafe", "disabled"])
DecisionConfigSchema = z.object({
  provider: DecisionProviderSchema,
  apiKey: z.string().optional(),
  model: z.string().optional(),          // effective default "jev-latest"
  endpoint: z.url().optional(),          // TypeSafe base URL; default https://api.typesafe.ai/v1
  uses: z.array(DecisionUseSchema).optional(),   // absent = every use
})

DecisionUseSchema = z.enum([
  "autoCategorization",   // ticket 05
  "allergyDetection",     // ticket 06
  "recipeProvenance",     // ticket 08
  "groceryLinking",       // ticket 09
  "validateEnrichments",  // ticket 10
])
DECISION_USES = DecisionUseSchema.options   // the default: all of them
```

**Uses.** The maintainer's rule: an administrator decides what the Decision Model does for _people_ — which kinds ask it, whether it links groceries, whether it validates recipes — and every use is **on by default** the moment a Decision Model is configured. What it does for Norish's own algorithms is not a setting: import triage (ticket 07) always runs when a Decision Model exists, because those questions only ever make an import cheaper or refuse a page that was never a recipe, and there is nothing for a household to opt out of. The shape is a list rather than a record of booleans because the control is a **multi-select** (below): the stored value is the selection. A block with no `uses` means every use, so a stored block that predates a use gains it; a use that is added in a later release is therefore on for everyone until an administrator deselects it, which is the maintainer's default. The loader exposes `isDecisionUseEnabled(use)`, which is `false` whenever no Decision Model is configured, so a feature asks one question.

plus the two pure helpers the runtime, the coordinator and the form all ask: `resolveDecisionSettings(config)` (fills the model and endpoint defaults) and `isDecisionConfigValid(config)` (provider not disabled, key present). There is **no** fallback to the AI block's key — the provider never matches — so the helper takes one argument, not two.

Loader (`server-config-loader.ts`): `getDecisionConfig(includeSecrets)` returning `null` for a server that never saved the block, and `isDecisionModelConfigured()` for the one-question callers.

tRPC (`packages/trpc/src/routers/admin/ai-config.ts`): `updateDecisionConfig` (drops the stored key when the provider changes, like its siblings) and `testDecisionEndpoint`, which sends one Boolean question ("Is this a test?" against the state `"test"`) through the runtime once ticket 04 lands, or — if this ticket lands first — a direct minimal request from `packages/auth/src/connection-tests.ts` beside `testAIEndpoint`. Either way the admin sees success or the provider's own error message (a 401 must read as a bad key, not as "request failed").

Admin form (`apps/web/app/(app)/settings/admin/components/decision-model-form.tsx`), a new accordion section in `ai-processing-card.tsx` after Image Generation:

- Provider select: Disabled, TypeSafe AI.
- API key: `SecretInput`, revealable through `fetchConfigSecret(DECISION_CONFIG, "apiKey")`, with the description linking to where a key comes from (typesafe.ai).
- Model: text field, placeholder `jev-latest`, description saying `jev-latest` follows TypeSafe's newest release.
- Endpoint: under an _Advanced_ disclosure, placeholder `https://api.typesafe.ai/v1`, described as "for a proxy or gateway; leave empty otherwise".
- Test button and result chip, as the AI form has.
- Dirty tracking through `onDirtyChange`, the unsaved-changes chip, and the context's `updateDecisionConfig`.
- A one-paragraph description at the top saying what the Decision Model is for and that it is optional, in the register of the Image Generation description.
- Below the connection fields, one **Use the Decision Model for** row: a `Select` with `selectionMode="multiple"`, built exactly like the **Automatic enrichment** multi-select in `ai-config-form.tsx` (same truncated joined-names trigger, same `ListBox`), listing Auto-categorization, Allergy detection, Recipe Provenance, Grocery linking, Validate enrichments. Everything selected by default; disabled (not hidden) while the provider is `disabled`; the row's description says import triage always uses the Decision Model and is not in the list. One control, not five switches.

The admin context (`settings/admin/context.tsx`) gains `decisionConfig` and `updateDecisionConfig`. Translations under `settings.admin.decisionConfig` in all fourteen locales.

Seeding: none. The block ships unconfigured and is admin-only, like Image Generation. The startup config backfill needs no entry.

## Acceptance criteria

- [ ] `decision_config` is a sensitive server-config key; a save that omits the key keeps the stored key; a provider change drops it.
- [ ] `getDecisionConfig` returns `null` on a fresh server and the parsed block after a save; `isDecisionModelConfigured` is false until a key is stored with a non-disabled provider.
- [ ] The admin form round-trips provider, model and endpoint, masks the key, reveals it on request, and shows the Test outcome.
- [ ] Test reports a bad key as a bad key (the provider's 401 message), and a reachable key as success.
- [ ] Global AI off leaves the block editable but the Test button explains AI is off (mirror the AI form's behaviour).
- [ ] Interface strings exist for every enabled locale; the i18n gate passes.
- [ ] Config schema tests cover the helpers and the defaults, including that a stored block without `uses` means every use.
- [ ] `isDecisionUseEnabled` is false for every use when no Decision Model is configured, true for all by default once one is, and follows the stored selection after a save.
- [ ] The multi-select round-trips a partial selection and is inert while the provider is disabled.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Environment-variable seeding (`TYPESAFE_API_KEY`). Follow-up if a self-hoster asks.
- A model listing. TypeSafe's SDK exposes one (`GET /v1/models`); not needed while `jev-latest` is the one sensible answer.
- Vercel AI Gateway as a provider member.

## Comments

- Filed 2026-09-19 with the spec.
- 2026-09-19 — Implemented. `ServerConfigKeys.DECISION_CONFIG = "decision_config"`, sensitive; `DecisionProviderSchema`, `DecisionUseSchema`, `DECISION_USES`, `DecisionConfigSchema`, `DEFAULT_DECISION_MODEL`/`DEFAULT_DECISION_ENDPOINT`, `resolveDecisionSettings(config)`, `isDecisionConfigValid(config)` (one argument, a type predicate) and `isDecisionUseSelected(config, use)` in `packages/config/src/zod/server-config.ts`. Loader: `getDecisionConfig(includeSecrets)` (null on a fresh server, null with a warn when a stored row no longer parses), `isDecisionModelConfigured()`, `isDecisionUseEnabled(use)` — the last is also false while AI is globally off, so "AI off" means no Decision leaves the server either. tRPC: `updateDecisionConfig` (drops the key on a provider change) and `testDecisionEndpoint` (stored key when omitted, through the runtime's `testDecisionModel`, so a 401 reads as a rejected key). Admin: `decision-model-form.tsx` after Image Generation in the AI & Processing accordion — provider select, `SecretInput` key, model field with the `jev-latest` placeholder, endpoint under an _Advanced_ disclosure, one **Use the Decision Model for** multi-select built like the automatic-enrichment one (all selected by default, inert while disabled), Test button and chip, dirty tracking; context and mutation hooks gained `decisionConfig`, `updateDecisionConfig`, `testDecisionEndpoint`. Translations in all fourteen locales (`settings.admin.decisionConfig`, `settings.admin.aiProcessing.decisionModel`); i18n gate green. Tests: `packages/config/__tests__/config/decision-config.test.ts` and the Decision block suite in `server-config-loader.test.ts`. No env seeding, no model listing, as specified.
- 2026-09-20 — Review fix. The form sent an explicit list even with all five uses selected, so a use added in a later release would have been off for every server that had saved the block once, against the ADR-0035 promise. `selectedDecisionUses(selected)` in `packages/config/src/zod/server-config.ts` now returns `undefined` for the full selection and the form stores that; `decision-config.test.ts` pins it, including that a block saved from the full selection still answers a later use with true.
- 2026-09-21 — Per the maintainer, the form lost its introductory paragraph, the description under the model field ("Leave empty to use it"), the description under the uses multi-select, and the whole _Advanced_ disclosure with the endpoint field, which will never be used. The model field is now hard-prefilled with `jev-latest` rather than showing it as a placeholder. `DecisionConfigSchema.endpoint` stays (the browser E2E seeds the block at the fake provider through `updateDecisionConfig`), and the form passes a stored endpoint through on Save and Test rather than dropping it. The six retired keys are gone from all fourteen locales; the docs table dropped its Endpoint row.
