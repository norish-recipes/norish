# Recipe Provenance Inference

Status: ready-for-agent

Source: [norish-recipes/norish#350](https://github.com/norish-recipes/norish/pull/350)

## Problem Statement

People importing recipes into Norish can see the recipe's name, ingredients, and instructions, but they do not get useful context about where the dish comes from, which cuisines it belongs to, or why that attribution is plausible. The existing proposal for recipe provenance demonstrates the product value, but it cannot be merged into the current release candidate: it bypasses repository and queue boundaries, does not authorize recipe mutations correctly, misses several import paths, can leave loading indicators active forever, is incomplete across locales and documentation, and conflicts with current HeroUI, queue-monitoring, and offline architecture.

Norish needs a release-candidate-native implementation that enriches imported recipes asynchronously without delaying import completion, exposes trustworthy progress and failure states, and preserves the existing household, repository, queue, realtime, offline, and documentation conventions.

## Solution

Add optional AI-generated Recipe Provenance to the web recipe-detail experience. Provenance consists of one nullable ISO 3166-1 alpha-2 origin country code, an optional region or sub-region, one or more cuisine labels, and a short, friendly explanation of the attribution. When a country is known, web recipe-name displays prefix the unchanged recipe name with the country flag derived from that code.

When an administrator enables automatic provenance, every successfully completed URL, paste, and image import queues background inference. Recipe editors can also request or retry inference manually. Administrators can enable the feature, control automatic inference, edit the inference prompt and cuisine vocabulary, and backfill recipes that have no provenance.

Inference runs through the existing operation-aware queue registry and AI-handler boundary. Recipe reads and writes go through repositories, tRPC procedures remain thin and enforce existing recipe access policy, and progress uses the existing recipe realtime channel as a low-latency signal backed by an authoritative status query. The recipe remains usable throughout processing. A first inference shows a local loading state only in the provenance area; re-inference keeps the previous provenance visible while showing that it is being updated. Every queued attempt reaches a terminal success or failure state, including permanent AI errors, missing recipes, and exhausted retries.

The implementation is rebuilt against `rc/0.20.0-beta`. Pull request #350 is a product reference, not an implementation base.

## User Stories

1. As a household member, I want an imported recipe to show its likely cultural and geographical origin, so that I can understand more about the food I am cooking.
2. As a household member, I want to see the recipe's origin country, so that the attribution is immediately understandable.
3. As a household member, I want to see a region or sub-region when the evidence supports one, so that broad country-level attribution is not the only context available.
4. As a household member, I want to see one or more cuisine labels, so that recipes with influences from multiple traditions are represented usefully.
5. As a household member, I want a short and friendly explanation of the attribution, so that the provenance is more informative than a bare label.
6. As a household member, I want uncertain provenance to be phrased as an inference rather than a verified historical fact, so that AI output is not presented with false authority.
7. As a household member, I want provenance inference to run after a URL import completes, so that importing remains responsive.
8. As a household member, I want provenance inference to run after a structured paste import completes, so that pasted recipes receive the same enrichment as URL imports.
9. As a household member, I want provenance inference to run after an AI-assisted paste import completes, so that the extraction method does not create inconsistent recipe behavior.
10. As a household member, I want provenance inference to run after an image import completes, so that recipes imported from photographs receive the same enrichment.
11. As a household member, I want an offline-queued import to receive provenance after Replay completes online, so that server-side AI work does not break the existing Outbox promise.
12. As a household member, I want the imported recipe to remain available while provenance is inferred, so that enrichment never blocks reading or cooking.
13. As a recipe viewer, I want only the provenance area to show a loading state, so that the rest of the recipe does not flash or disappear.
14. As a recipe viewer, I want a pending inference to be visible after navigation or reload, so that missing a realtime event does not hide active work.
15. As a recipe viewer, I want an inference result to appear without manually refreshing the recipe, so that background enrichment feels seamless.
16. As a recipe viewer, I want loading to end after success, failure, a missing recipe, a disabled feature, or exhausted retries, so that the interface never spins indefinitely.
17. As a recipe viewer, I want existing provenance to remain visible during re-inference, so that retrying does not temporarily remove useful information.
18. As a recipe viewer, I want a failed first inference to show a calm, actionable state instead of an empty skeleton, so that I understand the feature is not still working.
19. As a recipe editor, I want to request provenance manually when none exists, so that recipes created or imported before automatic inference can be enriched.
20. As a recipe editor, I want to retry failed inference, so that a temporary AI-provider failure is recoverable.
21. As a recipe editor, I want to re-run inference after substantially changing a recipe, so that its provenance can be refreshed deliberately.
22. As a recipe viewer without edit access, I want to view provenance but not trigger changes, so that recipe permissions remain consistent.
23. As a recipe owner, I want unauthorized users prevented from queueing or overwriting provenance, so that recipe access boundaries remain intact.
24. As a household member, I want recipe updates emitted according to the existing recipe view policy, so that provenance visibility matches the recipe's visibility.
25. As a user who requested inference, I want failure feedback targeted to me, so that unrelated household members are not shown operational errors for my action.
26. As an administrator, I want to enable or disable Recipe Provenance globally, so that I control whether the deployment uses this AI feature.
27. As an administrator, I want to enable or disable automatic inference for new imports separately, so that manual inference can remain available without automatic AI usage.
28. As an administrator, I want the feature to respect the global AI-provider setting, so that disabled AI is never bypassed.
29. As an administrator, I want to edit the provenance system prompt through the existing prompt administration experience, so that tone and inference guidance can be adapted without a deployment.
30. As an administrator, I want a safe default prompt when no override exists, so that the feature works immediately after being enabled.
31. As an administrator, I want to extend the cuisine vocabulary without a database migration, so that cuisine labels are not frozen to a release-time enum.
32. As an administrator, I want to remove a cuisine from future inference guidance without erasing it from existing recipes, so that configuration changes do not silently rewrite historical results.
33. As an administrator, I want to backfill recipes that have no provenance, so that existing collections can adopt the feature.
34. As an administrator, I want backfill to report queued, duplicate, skipped, completed, and failed work, so that its progress is understandable.
35. As an administrator, I want backfill to avoid overwriting recipes that already have any provenance, so that existing results are preserved unless an editor deliberately re-runs them.
36. As an administrator, I want repeated backfill requests to be idempotent, so that accidental clicks do not create duplicate AI charges.
37. As an administrator, I want the provenance queue represented in the existing job monitor, so that its attempts, steps, failures, duration, and retention follow other background work.
38. As a self-hosting operator, I want provenance jobs to use configured job retention, so that this queue does not ignore deployment policy.
39. As a self-hosting operator, I want transient AI failures retried with bounded backoff, so that temporary provider outages can recover without infinite work.
40. As a self-hosting operator, I want permanent AI errors to stop retrying and reach a visible terminal state, so that invalid requests do not waste provider capacity.
41. As a self-hosting operator, I want inference input limited to recipe content needed for attribution, so that household and account data are not unnecessarily sent to the AI provider.
42. As a user of any supported locale, I want provenance controls, states, explanations, and errors localized, so that the feature does not fall back to untranslated keys.
43. As a keyboard or screen-reader user, I want progress and terminal status changes announced accessibly, so that asynchronous enrichment is understandable without relying on animation.
44. As a maintainer, I want the feature documented with screenshots and included in the target release notes, so that users can discover and configure it.
45. As a maintainer, I want the implementation limited to Recipe Provenance, so that unrelated deployment, Docker, parser, offline, and production-sync changes do not obscure review.
46. As a recipe viewer, I want a known origin represented by a country flag before the recipe name, so that provenance is recognizable at a glance.
47. As a recipe editor, I want the stored and editable recipe name to remain unchanged, so that provenance presentation does not alter imported content.
48. As a recipe viewer, I want the same flag treatment on web recipe detail, recipe cards and lists, and shared-recipe pages, so that the presentation is consistent.
49. As a recipe viewer, I want uncertain origin to omit the flag rather than show a guess, so that decoration does not overstate the inference.
50. As the original contributor, I want the release notes to credit `@edylan` and link to pull request #350, so that the feature's provenance is preserved even though it is rebuilt for the release candidate.

## Implementation Decisions

- The data model adds one nullable ISO 3166-1 alpha-2 origin country code, nullable region or sub-region, a list of cuisine labels, and a nullable explanatory note to the recipe. Existing recipes migrate without fabricated provenance.
- The structured inference output returns exactly one origin country code or `null`. The default prompt asks for the primary country of origin. For a known multinational dish it selects one primary or first-recognized country and describes the broader heritage in the explanation; when origin is genuinely uncertain it returns `null`.
- Origin country codes are validated against ISO 3166-1 alpha-2 in code. Country names are localized with platform internationalization APIs and flags are derived from the validated code. The prompt may explain country selection, but neither the prompt nor admin configuration owns a duplicated or editable country list.
- Cuisine labels are stored as normalized text values rather than a PostgreSQL enum. The admin configuration supplies an extendable vocabulary used to guide and validate future inference. Changing that vocabulary does not rewrite existing recipes.
- A recipe is eligible for automatic backfill only when it has no provenance values at all. Partial or existing provenance is changed only by an explicit editor-triggered re-inference.
- The inference response is validated as structured data before persistence. Values are trimmed and bounded; cuisine values are deduplicated; an empty or invalid response is a terminal failure rather than a partial database write.
- The default prompt asks for a concise, friendly, declarative explanation and prohibits first-person phrasing. The UI labels the result as AI-inferred context rather than verified historical scholarship.
- Global `enabled` and `automatic for new imports` settings live with existing AI configuration. The provenance prompt lives in the existing prompt administration surface, and the cuisine vocabulary is editable in the provenance section of AI settings.
- Automatic inference is attached to the single successful recipe-import completion boundary shared by URL, paste, and image workflows. Each recipe created by a multi-recipe paste import is considered independently.
- A replayed offline import follows the same server completion path. The feature does not add client-side AI execution or a new Outbox mutation type.
- Import completion is not delayed by provenance. Failure to queue or infer provenance does not roll back an otherwise successful recipe import.
- A dedicated provenance queue is registered through the current queue registry and operation-aware queue factory. It participates in configured retention, lifecycle initialization and shutdown, concurrency, stalled-job handling, hanging-job detection, and the admin job monitor.
- Provenance jobs use deterministic per-recipe identifiers. Producers return a typed `queued`, `duplicate`, or `skipped` outcome; skipped and duplicate work must not emit false started or completed events.
- The worker reports at least AI-request and saving steps through the existing job-step mechanism. Retryable provider failures use bounded queue retries; permanent failures and the final exhausted retry emit a terminal failure state.
- Queue job data contains identifiers and policy context, not a copied recipe document. The worker loads current recipe data immediately before inference so that it does not enrich stale import input.
- Database reads and writes are implemented in the recipe repository. Neither tRPC procedures nor queue workers perform direct Drizzle queries.
- AI inference is exposed to the queue worker through the existing registered queue API-handler boundary. The queue package does not import the API or tRPC packages and does not introduce a dependency cycle.
- The repository save operation updates all provenance values atomically. Re-inference leaves the previous values intact until the replacement result has been validated and saved successfully.
- Manual trigger and status procedures live in the recipe API surface. The trigger requires recipe edit access; status requires recipe view access. Admin configuration and backfill remain admin-only.
- The trigger procedure performs authorization and delegates to the queue producer. It does not duplicate repository selection, queue-state, AI, or event logic.
- The backfill procedure delegates candidate selection to the repository and queueing to the producer. It returns aggregate queued, duplicate, and skipped counts immediately; continuing progress is read from authoritative job state.
- Recipe provenance exposes an authoritative status snapshot with `idle`, `queued`, `processing`, `succeeded`, and `failed` states. A trigger response may additionally report `skipped` when AI or provenance is disabled.
- The existing recipe realtime channel is extended with typed provenance lifecycle events. Realtime events invalidate or refresh the status and recipe queries; they are a low-latency path, not the source of truth.
- Every execution path reaches a terminal state. This includes missing recipes, disabled configuration, invalid AI output, permanent provider errors, final retry exhaustion, successful persistence, and successful no-op deduplication.
- Recipe-content updates are emitted through the existing recipe permission policy. Operational failure feedback is sent only to the requesting user; admin backfill progress remains in the admin surface.
- Shared recipe hooks consume the status query and existing recipe subscription contract so web surfaces do not create a parallel web-only subscription architecture.
- The recipe-detail provenance component owns only its panel state. On first inference it shows a localized skeleton or progress label; during re-inference it keeps current values visible; on failure it exposes an editor-only retry action; on success it renders the data.
- A shared web presentation helper prefixes a known origin flag to the recipe name on recipe detail, recipe cards and lists, and shared-recipe pages. It never changes the persisted name, editable form value, search text, URL, or export value. Native mobile presentation remains unchanged.
- The flag precedes the recipe name, for example `🇮🇹 Lasagne`. It is decorative to assistive technology because the provenance content exposes the localized country name. A `null` origin code renders the original name with no flag or placeholder.
- Loading state is derived from the authoritative status snapshot plus the local trigger mutation. HeroUI v3 pending APIs are used, and controls are disabled only for the operation they represent.
- The admin backfill control distinguishes the short mutation-submission state from ongoing batch progress. It cannot remain in a pending state solely because a realtime event was missed.
- All user-visible strings are added to every bundled locale. Code-level fallback strings are not used as a substitute for catalog coverage.
- The recipe glossary gains the terms Recipe Provenance, origin, cuisine label, and provenance inference. Product documentation explains that the result is AI-generated, how to enable automatic inference, how to run backfill, and how editors can retry it.
- The target `0.20.0-beta` release notes include the feature and explicitly credit `@edylan` with a link to pull request #350. The documentation includes screenshots of recipe provenance, its loading/failure states, and the admin settings.
- No existing offline ADR is revised. In particular, Serwist remains the service-worker owner, realtime remains non-durable, and server-side-effect imports run at Replay time.

## Testing Decisions

- Tests assert externally observable behavior: persisted recipe provenance, authorized API results, queue outcomes, lifecycle status, emitted recipe updates, and rendered user states. They do not assert private helper calls or component implementation details.
- The primary acceptance seam is a production-like web flow beginning with an import and ending on recipe detail. It replaces only the third-party AI-provider boundary with a deterministic structured response; Norish's real tRPC, queue worker, repository, status query, realtime refresh, and web UI remain in the path. It verifies import completion, provenance queueing, a visible pending state, repository persistence, realtime refresh, and final rendered provenance. The paste-import path is the representative browser scenario because it exercises the workflow promised by the originating PR without relying on an external website or AI provider.
- The successful browser flow verifies that a known country prefixes the unchanged name with the derived flag on recipe detail, recipe cards or lists, and the shared-recipe page. It also covers an uncertain `null` country rendering the unchanged name without a flag. Editable fields, search values, URLs, and persisted names must remain undecorated.
- The same browser seam covers a terminal AI failure and retry: the provenance panel must leave loading, expose a retry to an editor, retain existing provenance during re-inference, and recover after a successful retry.
- Queue integration tests cover URL, structured paste, AI-assisted paste, image, and multi-recipe paste completion. Each eligible recipe queues exactly one job; disabled, duplicate, and already-enriched cases do not produce false lifecycle events.
- Worker integration tests control the registered AI handler while using the real repository boundary. They cover valid persistence, invalid structured output, missing recipes, permanent failure, transient retry, final retry exhaustion, and atomic preservation of previous provenance.
- Recipe API permission tests follow the existing recipe-permissions integration suite. They prove that viewers can read status, editors can trigger inference, unauthorized users cannot discover or mutate private recipes, and only admins can configure or backfill.
- Status and subscription tests prove that mounting after a started event still shows active work, success refreshes the recipe, every terminal failure clears pending state, skipped producers never show loading, and duplicate triggers remain idempotent.
- Recipe-detail component tests follow the existing recipe-detail context and recipe subscription tests. They cover first-load skeleton, re-inference with stale data retained, accessible status announcements, localized failure, retry, and editor/viewer control differences.
- Admin UI tests follow the existing admin settings and job-queue tests. They cover HeroUI v3 pending behavior, dirty-state integration, enable/auto toggles, cuisine vocabulary editing, prompt fallback and override, backfill counts, progress, and terminal failures.
- Repository integration tests cover the migration defaults, candidate selection for backfill, normalized cuisine persistence, atomic provenance updates, and preservation of partial/existing provenance during automatic backfill.
- Locale validation must pass with the new keys present in every supported catalog. Documentation formatting and the production documentation build must pass with valid screenshots, links, and anchors.
- Definition-of-done validation is `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, and `pnpm build`, plus the focused package and browser suites above. The feature is not complete or merge-ready until the browser E2E suite passes. Passed, failed, and environmentally blocked results are reported separately; an environmentally blocked browser suite remains incomplete rather than counting as acceptance evidence.

## Out of Scope

- Merging or repairing pull request #350 in place; this specification describes a fresh RC-native implementation.
- Unrelated production synchronization scripts, deployment helpers, Docker changes, parser timeouts, server polyfills, health checks, version reporting, CalDAV work, or build-system changes.
- Changes to Serwist, the Offline Cache, Outbox, Replay protocol, or the existing offline guarantee beyond allowing current import Replay to reach the normal provenance completion boundary.
- Blocking recipe import on provenance inference or rolling back a successful import when enrichment fails.
- Running AI inference in the browser or while the server is unreachable.
- Treating AI-generated provenance as verified authorship, ownership, cultural authenticity, or historical proof.
- A general-purpose cuisine ontology, geographic database, map, configurable country vocabulary, cuisine search/filter feature, or automatic merging of synonymous cuisine labels.
- Automatically re-running inference after every recipe edit. Refresh is explicit after initial import.
- Native mobile provenance UI in this release. Shared recipe contracts must remain compatible so mobile support can follow without another schema redesign.
- A standalone command-line backfill script; the supported backfill workflow is the authenticated admin experience and existing job monitor.
- Rewriting existing provenance when an administrator changes the cuisine vocabulary or prompt.

## Further Notes

- The originating PR established that Recipe Provenance is wanted for an upcoming release, but its code should be treated as reference material only. The RC queue registry, HeroUI v3 components, repository layer, shared hooks, recipe permission helpers, and existing recipe subscription are the implementation baseline.
- Realtime delivery can be missed during navigation or reconnect. The status query is therefore mandatory even though subscriptions provide the seamless update path.
- Provenance is an asynchronous enhancement. A recipe with no provenance remains complete and usable.
- The highest-seam acceptance test should be established before lower-level implementation so queue, repository, realtime, and UI work converge on one observable workflow.
