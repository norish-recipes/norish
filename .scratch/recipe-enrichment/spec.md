# Unified Recipe Enrichment

Status: ready-for-agent

## Problem Statement

Norish creates recipes through several paths: manual entry, URL import, pasted structured data, pasted AI-parsed data, and image import. Those paths currently mix recipe extraction, persistence, AI inference, queue enrollment, and user notification in different combinations. Some enrichments happen inside an import prompt, some are queued afterward, some are absent from particular import paths, and some automatic settings also prevent a user from requesting the same work manually.

This makes the behavior difficult to predict. The result can depend on how a recipe entered Norish rather than on the stored recipe and the administrator's settings. Supplied categories or Nutrition Information can be overwritten unnecessarily, parallel tag writers can lose each other's changes, and the four enrichment kinds expose inconsistent lifecycle state and failure feedback.

Norish needs one comprehensible lifecycle: first create a Usable Recipe, then independently enroll the eligible Recipe Enrichment work. Recipe creation must remain successful even when optional AI work is disabled, unavailable, delayed, or unsuccessful.

## Solution

Introduce one event-driven Recipe Enrichment flow for every newly persisted Usable Recipe, regardless of whether it was entered manually or imported by URL, paste, structured data, or image.

Recipe creation and import remain responsible for extracting and persisting recipe content and Supplied Recipe Data. Once a genuinely new recipe is committed and loadable, an internal post-commit event wakes one enrichment coordinator. The coordinator reloads the stored recipe, evaluates global AI availability, the four independent automatic settings, each enrichment kind's input requirements, and the stored-data precedence rules. It then enrolls every eligible job independently so one failure cannot block the other enrichments or change recipe creation success.

Auto-tagging and allergy detection append findings without removing existing tags. Auto-categorization and nutrition estimation replace their target values only after substantive validated output. Automatic replacement work is suppressed when the corresponding Supplied Recipe Data is already present. Manual Recipe Enrichment remains available per kind to authorized recipe editors whenever AI is enabled, even when that kind's automatic setting is disabled.

All four kinds share one lifecycle contract with independent `idle`, `queued`, `processing`, `succeeded`, and `failed` states. Automatic failures are quiet but visible in recipe status; manual failures additionally notify the requester. Canonical realtime recipe updates and lifecycle events keep clients current without periodic polling.

## User Stories

1. As a recipe importer, I want recipe creation to finish before optional enrichment begins, so that AI availability does not determine whether my import succeeded.
2. As a recipe importer, I want URL imports to use the same enrichment flow as other creation paths, so that behavior does not depend on the source format.
3. As a recipe importer, I want pasted structured recipes to use the same enrichment flow as URL imports, so that they receive the same eligible enrichment.
4. As a recipe importer, I want pasted AI-parsed recipes to use the same enrichment flow as structured recipes, so that using AI as a reader does not bypass later policy.
5. As a recipe importer, I want image imports to use the same enrichment flow as other imports, so that vision parsing does not silently aggregate unrelated inference.
6. As a recipe author, I want a manually created recipe to enter the same automatic enrichment flow, so that importing is not a prerequisite for automation.
7. As a recipe author, I want a recipe to become usable when its creation transaction succeeds and it can be loaded, so that enrichment does not impose a second completeness definition.
8. As a recipe author, I want incomplete-but-valid stored recipes to remain successfully created, so that optional AI input requirements do not become recipe validation rules.
9. As a recipe owner, I want later edits not to retrigger automatic enrichment, so that editing a recipe does not unexpectedly spend AI or replace values.
10. As a user importing a duplicate recipe, I want an existing matched recipe not to be treated as newly created, so that it is not automatically enriched again.
11. As a user, I want recipe creation or import success feedback immediately after persistence, so that it is not delayed by background work.
12. As an administrator, I want one independent automatic setting for each enrichment kind, so that I can choose exactly which AI work runs by default.
13. As an administrator, I want global AI disablement to suppress every automatic and manual enrichment, so that no AI request bypasses deployment policy.
14. As an administrator, I want auto-tagging strategy to remain configurable separately from whether auto-tagging runs automatically, so that disabling automation does not disable manual use.
15. As an administrator, I want new automatic settings to avoid silently increasing AI usage during upgrade, so that costs and data flow remain intentional.
16. As a recipe author, I want manual enrichment to remain available when its automatic setting is disabled, so that automation policy does not remove an editing tool.
17. As a recipe author, I want manual enrichment actions to remain per kind, so that I can request exactly one change instead of running all AI work.
18. As a recipe editor, I want manual enrichment to verify my edit permission, so that viewing a recipe does not grant permission to modify it through AI.
19. As a recipe editor, I want a clear immediate error when a manual request cannot be enrolled, so that I know the action did not start.
20. As a recipe editor, I want an active enrichment kind to reject a duplicate manual request, so that the same work does not run concurrently.
21. As a recipe editor, I want to run a kind again after a terminal result, so that retained queue history does not prevent a deliberate refresh.
22. As a recipe editor, I want to retry a failed automatic enrichment manually, so that quiet background failure has a recovery path.
23. As a recipe author, I want supplied tags preserved when auto-tagging completes, so that AI cannot remove my existing organization.
24. As a recipe author, I want supplied allergy indications preserved when allergy detection completes, so that AI cannot remove existing safety information.
25. As a recipe author, I want new auto-tagging findings appended without duplicates, so that enrichment expands rather than rewrites my tags.
26. As a recipe author, I want new allergy findings appended without duplicates, so that repeated detection remains safe.
27. As a recipe author, I want concurrent tagging and allergy jobs to preserve both sets of findings, so that completion order cannot lose data.
28. As a recipe author, I want automatic categorization skipped when substantive categories were supplied, so that trusted stored values take precedence.
29. As a recipe author, I want automatic nutrition estimation skipped when any substantive Nutrition Information was supplied, so that partial trusted data is not overwritten by estimation.
30. As a recipe author, I want null and blank category or nutrition values treated as absent, so that empty placeholders do not suppress useful enrichment.
31. As a recipe editor, I want manually requested categorization to replace the current categories, so that I can deliberately refresh them.
32. As a recipe editor, I want manually requested nutrition estimation to replace the complete Nutrition Information group, so that old and new estimates are not mixed.
33. As a recipe editor, I want an empty or invalid AI result rejected before replacement, so that a failed inference cannot erase good stored values.
34. As a recipe author, I want automatic replacement to recheck stored values at write time, so that data supplied while AI was running still wins.
35. As a recipe importer, I want categories or Nutrition Information explicitly present in the source preserved as supplied facts, so that deterministic source data outranks inference.
36. As a recipe importer, I want AI to be allowed to read explicit source facts, so that image or unstructured imports can preserve information that is visibly present.
37. As a recipe importer, I want the extraction step not to infer enrichment findings beyond the source, so that all inference follows the same background policy.
38. As a household member, I want allergy detection skipped when the household has no configured allergies, so that Norish does not make a pointless AI request.
39. As a recipe author, I want a persisted recipe with insufficient input for a particular enrichment to remain successfully created, so that one kind's input requirement does not invalidate the recipe.
40. As a user, I want the four enrichment jobs to run independently, so that a slow or failed kind does not serialize or block the others.
41. As a user, I want one job enrollment failure not to block the other eligible kinds, so that partial infrastructure failure has limited impact.
42. As a user, I want an automatic enrichment failure not to produce an error toast, so that optional background work does not look like recipe creation failure.
43. As a recipe editor, I want a terminal manual enrichment failure to produce an error toast, so that an action I requested has visible feedback.
44. As a user, I want successful enrichment to update the displayed recipe without a success toast, so that the result is visible without notification noise.
45. As a user, I want each enrichment kind to show `queued` while waiting, so that I know the request was accepted.
46. As a user, I want each enrichment kind to show `processing` while its worker is active, so that I can distinguish waiting from execution.
47. As a user, I want each enrichment kind to show `succeeded` after substantive output is applied, so that completion is visible.
48. As a user, I want each enrichment kind to show `failed` after retries are exhausted, so that quiet failures can be discovered and retried.
49. As a user, I want enrichment states to recover correctly after opening or refreshing a recipe, so that status does not depend on having witnessed every realtime event.
50. As a user, I want realtime lifecycle events to update status directly, so that Norish does not periodically poll queues.
51. As a user, I want canonical recipe updates to update client caches directly, so that successful enrichment does not require an unnecessary refetch.
52. As a user, I want reconnect and normal query recovery to converge on current recipe and job state, so that missed realtime events self-heal.
53. As an administrator, I want failed and completed enrichment jobs to follow the existing queue retention policy, so that this feature does not create a separate history system.
54. As an administrator, I want retained failed jobs to remain visible in the existing job monitor, so that operational diagnosis stays in one place.
55. As an administrator, I want a retained job's recipe status to return to `idle` after the job is removed, so that status mirrors queue truth.
56. As an operator running multiple server instances, I want repeated delivery of the creation event to be harmless, so that multiple listeners do not duplicate automatic work.
57. As an operator, I want the enrichment listener registered as part of normal server startup, so that every process capable of creating recipes has the expected runtime shape.
58. As an operator, I accept that a brief process or Redis interruption can miss a non-persisted creation event, so that this feature does not require a transactional outbox.
59. As a maintainer, I want one coordinator interface to express automatic eligibility, so that import workers no longer duplicate policy decisions.
60. As a maintainer, I want enrichment workers to own AI execution rather than enrollment policy, so that each module has one clear responsibility.
61. As a maintainer, I want repository operations to encode append and replace semantics, so that callers cannot accidentally implement them differently.
62. As a maintainer, I want one combined lifecycle contract for all four kinds, so that clients do not need four unrelated status implementations.
63. As a maintainer, I want the implementation documented with release notes and screenshots, so that users and self-hosters can understand the new controls and behavior.

## Implementation Decisions

### Vocabulary and lifecycle

- Use the glossary terms Usable Recipe, Recipe Enrichment, Automatic Recipe Enrichment, Automatic Enrichment Enrollment, Manual Recipe Enrichment, Supplied Recipe Data, Imported Recipe Data, and Nutrition Information.
- A Usable Recipe is one whose creation transaction succeeded and whose stored state can be loaded. Existing creation validation remains authoritative; the enrichment flow adds no title, ingredient, step, description, or image requirement.
- Automatic Recipe Enrichment is enrolled once when a recipe first becomes usable. It applies to manual creation and every import path. Ordinary recipe updates do not enroll it again.
- A creation operation that resolves to an existing recipe is not a new creation and does not emit the automatic enrollment event. The recipe creation repository interface must distinguish a new insert from an existing match rather than returning an ambiguous identifier alone.
- Recipe creation and import success are terminal before enrichment. Enrichment cannot roll back, downgrade, or delay that success.

### Extraction and enrichment separation

- Import modules return recipe content and Supplied Recipe Data. They do not decide which Recipe Enrichment jobs run.
- AI may be used as a reader during import. Categories, tags, allergy indications, and Nutrition Information explicitly present in source material may be extracted and persisted as Supplied Recipe Data.
- Import extraction prompts and schemas must stop asking AI to infer tags, allergies, categories, or nutrition beyond what is explicitly supported by the source. Inferred output belongs exclusively to the corresponding background enrichment worker.
- No source or inference provenance model is introduced. The extraction module is responsible for honoring the source-fact contract, but the database stores the existing recipe fields only.
- Null strings, whitespace-only strings, empty arrays, and absent values are normalized away before persistence and eligibility evaluation.

### Creation event and listener

- After a genuinely new recipe commits and can be loaded, the creation module publishes one internal `recipe became usable` event. Publication occurs after commit and before the creation path reports all post-commit work complete.
- The event carries recipe identity and the minimal initiating user and household context needed to enroll jobs. It does not copy parser output; the coordinator always loads current stored state through the recipe repository.
- The internal event is separate from permission-scoped client recipe events. Client visibility policy must not determine whether the coordinator receives the event.
- Follow the existing calendar-integration shape: initialize an event listener during normal server startup, subscribe before recipe-producing workers and HTTP handlers can publish, and retain reconnect/error logging.
- Initial listener registration must be awaited or otherwise made ready before recipe creation paths become available. An initialization failure must not be logged as successful initialization.
- The event uses the existing Redis event infrastructure and is not persisted or replayed. A brief process or Redis interruption is an accepted enrollment loss window. Do not add a transactional outbox, periodic scheduler, coordinator queue, saga, or compensating action.
- Multiple running listeners may observe the same event. Automatic enrollment and job identity must therefore be idempotent.

### Coordinator interface and module depth

- Introduce one deep Recipe Enrichment coordinator interface as the primary policy and testing seam.
- The coordinator accepts a recipe identity, trigger origin, initiating user/household context, and either automatic enrollment or one manually selected enrichment kind.
- For automatic enrollment, the coordinator loads the current recipe and configuration once, calculates four independent eligibility decisions, and attempts every eligible producer independently. Use an all-settled shape so a thrown producer error cannot short-circuit sibling enrollment.
- Coordinator outcomes are typed per kind: `queued`, `duplicate`, `skipped` with a reason, or `failed-to-queue`. The result supports tests and structured logging; automatic creation does not wait for the jobs themselves.
- Producers own queue mechanics and duplicate detection. They must not read automatic enablement settings, because doing so currently makes manual availability depend on automatic policy.
- Workers own one AI request, output validation, repository persistence, and lifecycle publication for one enrichment kind. They do not contain import-path policy.
- Repository modules own append, unconditional replace, and conditional automatic replace semantics. Routers and workers do not perform direct database writes.
- Thin authorized mutation interfaces expose manual requests. One combined query and one typed subscription interface expose lifecycle state.

### Automatic eligibility and precedence

| Kind                 | Automatic eligibility after global AI and per-kind enablement                                                                | Persistence rule                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Auto-tagging         | Run when the kind's input contract and tagging strategy are usable, regardless of existing tags                              | Atomically append normalized findings                                                                              |
| Allergy detection    | Run when the kind's input contract is usable and the household has configured allergies, regardless of existing allergy tags | Atomically append normalized findings                                                                              |
| Auto-categorization  | Run only when the stored category list is empty after normalization                                                          | Replace the category list after substantive validated output, conditional on it still being empty                  |
| Nutrition estimation | Run only when calories, fat, carbohydrates, and protein are all absent after normalization                                   | Atomically replace all four fields after substantive validated output, conditional on the group still being absent |

- Any substantive stored category suppresses automatic categorization.
- Nutrition Information is one atomic precedence group. Any substantive value among calories, fat, carbohydrates, or protein suppresses automatic nutrition estimation for the whole group; partial supplied nutrition remains untouched.
- Imported and manually entered Supplied Recipe Data have identical precedence after persistence.
- Supplied tags and allergy indications do not suppress automatic append work.
- Eligibility is based on stored state, not on whether parsing used AI and not on copied parser metadata.
- A recipe can be usable while lacking sufficient input for a particular kind. That kind returns `skipped: insufficient-input`; the recipe and other eligible kinds are unaffected.
- Automatic category and nutrition workers repeat their absence check in the repository write transaction. If substantive data appeared while AI was running, the write becomes a successful no-op and the newer supplied data wins.

### Manual eligibility and behavior

- Manual Recipe Enrichment remains four separate actions. Do not add a `run all` action.
- Every manual mutation requires global AI enablement, a loadable recipe, and explicit recipe edit authorization.
- Manual availability ignores the corresponding automatic enablement setting. It still observes the selected tag strategy, configured household allergies, and the kind's input contract.
- Manual auto-tagging and allergy detection use the same atomic append operations as automatic jobs.
- Manual auto-categorization replaces the complete current category list after receiving a non-empty validated result.
- Manual nutrition estimation replaces the complete Nutrition Information group atomically. After normalization, omitted or blank fields become null; at least one substantive nutrition value is required before any replacement occurs.
- Empty or invalid replacement output is a worker failure and follows normal retries. Existing values remain unchanged on every failed attempt.
- If a job for the same recipe and kind is queued or processing, a manual mutation returns a conflict and does not enqueue another.
- A terminal completed or failed job retained for history must not permanently prevent a later manual run. Manual rerun/retry follows existing queue retry conventions while presenting the same lifecycle contract.
- Job data records `automatic` or `manual` origin. Manual jobs also record the requesting user so terminal failure notification can be targeted correctly.

### Automatic configuration

- Retain global AI enablement as the top-level prerequisite.
- Provide independent automatic controls for auto-tagging, allergy detection, auto-categorization, and nutrition estimation.
- Separate the auto-tagging strategy from automatic auto-tagging enablement. A disabled automatic switch must not erase the selected strategy or prevent manual auto-tagging.
- Migrate the existing auto-tagging mode without changing its effective enabledness: `disabled` becomes automatic auto-tagging off with `predefined` retained as the manual strategy; every other mode becomes automatic auto-tagging on with the same strategy.
- Migrate the existing automatic allergy setting directly to the new allergy-detection switch.
- Newly introduced automatic category and nutrition controls default off for existing and new installations until an administrator explicitly enables them. This prevents an upgrade from silently increasing AI work; document the opt-in in administrator documentation and release Upgrade notes.
- Configuration loading, normalization, administrator editing, validation, and tests must use one canonical configuration contract.

### Queue identity, retries, and independence

- Keep four independent BullMQ jobs and workers. Do not aggregate all enrichment into one AI request or serialize the four kinds.
- Automatic jobs use deterministic recipe-and-kind identity so duplicate creation events coalesce harmlessly.
- Manual runs remain repeatable after terminal states. Active duplicate detection is per recipe and kind rather than treating retained terminal jobs as active forever.
- One coordinator producer failure is logged with recipe, kind, and origin and returned as `failed-to-queue`; the coordinator continues attempting the other kinds.
- An automatic failed-to-queue outcome is quiet and does not affect creation success. A manual failed-to-queue outcome is returned immediately to the requester and shown as an error.
- Inherit the existing attempts, backoff, removal-on-complete, removal-on-failure, administrator job monitoring, and failed-job retry conventions. Do not introduce a separate retry policy or persisted attempt-history model.

### Persistence semantics

- Replace read-delete-recreate tag merging with a repository append operation that inserts only missing normalized tag links. It must be safe when auto-tagging and allergy detection finish concurrently.
- Tag and allergy append operations never delete existing recipe tags and are idempotent under job retry.
- Category replacement validates the complete proposed category list before changing stored links or values.
- Nutrition replacement validates and normalizes the proposed group before atomically setting calories, fat, carbohydrates, and protein. A partial substantive result clears omitted fields because replacement cannot mix an old estimate with a new one.
- Automatic replacement uses a conditional repository operation that applies only while the target remains absent. Manual replacement is intentional and unconditional after validation.
- Every successful write returns or reloads the canonical full recipe representation used by realtime recipe updates.

### Lifecycle and realtime behavior

- Define one enrichment-kind vocabulary: `auto-tagging`, `allergy-detection`, `auto-categorization`, and `nutrition-estimation`.
- Define one lifecycle vocabulary per recipe and kind: `idle`, `queued`, `processing`, `succeeded`, and `failed`.
- The combined status query is the authoritative initial/recovery read. It maps retained BullMQ state to the lifecycle vocabulary and selects the current or latest retained run for each kind.
- Waiting, delayed, and equivalent accepted states map to `queued`; active maps to `processing`; completed maps to `succeeded`; failed maps to `failed`; no retained job maps to `idle`.
- When configured retention removes a terminal job, the query naturally returns `idle`. Do not persist a second lifecycle table.
- Status reads are permission-aware and must not disclose another user's inaccessible recipe or job data.
- Publish one typed lifecycle event shape for every kind and transition. It includes recipe identity, kind, lifecycle state, origin, and requester information only where needed for targeted feedback.
- Lifecycle events update the combined status cache directly. Canonical recipe-updated events update recipe detail and list caches directly after successful persistence.
- Initial query, subscription establishment, normal focus/remount behavior, and existing reconnect Recovery converge missed events. Do not add periodic enrichment polling or routine success-path refetches.
- Automatic terminal failures remain visible as quiet failed status while retained, with no error toast.
- Manual terminal failures emit an error only to the requesting user and retain failed status for authorized viewers.
- Queued, processing, and succeeded transitions use inline status and the updated recipe. Do not add enrichment success toasts.
- Recipe creation/import success feedback remains independent and still occurs after the recipe becomes usable.

### Client interactions

- Present manual actions only when global AI is enabled and the current user can edit the recipe. Automatic switches do not hide manual actions.
- Disable an action while that recipe and kind is queued or processing.
- Show the same four lifecycle states consistently wherever enrichment controls are presented.
- A manual enqueue rejection or terminal failure uses the existing error-toast conventions. Automatic errors never use that adapter.
- Shared client hooks and contexts consume the combined status and lifecycle contracts instead of four duplicated query/subscription families.
- Web and mobile clients using the shared recipe hooks receive the same state semantics; each client may place the affordance according to its existing recipe-action layout.

### Documentation and rollout

- Update administrator AI settings documentation to describe global enablement, four independent automatic controls, tag strategy, Supplied Recipe Data precedence, and manual availability.
- Update recipe user documentation with screenshots of manual actions and lifecycle states.
- Add Target Version release notes describing the unified flow and quiet background behavior.
- Add Upgrade notes for configuration migration/defaults. No new environment variable is expected; if implementation introduces one, follow the repository environment-documentation requirements.
- Use Recipe Enrichment vocabulary in user text, logs, contracts, documentation, and tests. Do not introduce Recipe Provenance terminology.

## Testing Decisions

- Tests assert observable decisions and stored outcomes through the highest practical seam. They must not assert private helper call order or internal module layout.
- The primary seam is the Recipe Enrichment coordinator interface. Feed it a persisted recipe, configuration, and origin; observe typed per-kind enrollment results and the jobs admitted to queues.
- Coordinator tests cover all creation origins through the same event, duplicate events, existing-recipe matches, global AI disabled, every per-kind automatic switch, insufficient input, no configured household allergies, supplied category precedence, atomic nutrition precedence, and independent failure when one producer throws.
- Event-listener integration tests publish the internal usable-recipe event through the real event infrastructure and verify coordinator enrollment. They also verify listener readiness during normal startup and harmless duplicate delivery.
- Creation-path integration tests cover manual create, URL import, structured paste, AI paste, and image import. Each test verifies that persistence succeeds first, a genuinely new recipe emits exactly one internal event, and an existing match does not.
- Extraction tests verify that deterministic parsers and AI-as-reader parsing preserve explicit categories, nutrition, tags, and allergy indications while extraction prompts no longer request unsupported inference.
- AI extraction tests mock only the external AI provider and distinguish explicit source facts from inferred content. No provenance fields or source-history storage are expected.
- Eligibility matrix tests normalize null, blank, whitespace-only, and empty values. They verify that one substantive nutrition field suppresses the whole automatic nutrition kind and that any category suppresses automatic categorization.
- Repository integration tests use a real database to verify atomic append, duplicate normalization, category replacement, Nutrition Information replacement, failed-validation no-op behavior, and conditional automatic replacement.
- A concurrency integration test runs tag and allergy appends in parallel against the same recipe and proves that existing tags plus both new finding sets remain afterward.
- Worker tests cover one kind at a time with a mocked external AI provider. They verify validated persistence, retries on invalid/empty output, final lifecycle failure, canonical recipe update emission, and origin-aware notification behavior.
- Manual mutation tests verify global AI requirements, explicit edit authorization, independence from automatic switches, per-kind input errors, active duplicate conflicts, terminal reruns, and requester-only failure feedback.
- Queue tests verify deterministic automatic identity, repeatable manual identity, active duplicate detection, independent queues, and inherited retry/retention options.
- Combined-status tests cover all BullMQ-to-lifecycle mappings, newest/current run selection, permission filtering, terminal retention, and return to `idle` after removal.
- Shared client-hook tests verify direct lifecycle-cache updates, direct canonical recipe-cache updates, missed-event recovery through initial/refocus/reconnect reads, no routine invalidation after success, and no periodic polling.
- UI tests verify action visibility from AI/edit permission rather than automatic settings, per-kind disabled state while active, inline lifecycle rendering, quiet automatic failures, manual enqueue error toasts, manual terminal failure toasts, and absence of success toasts.
- Production-like browser E2E is required because acceptance crosses creation, queues, WebSocket delivery, cache updates, and visible feedback. Mock only the external AI provider while using the real Norish server, database, Redis, BullMQ workers, repositories, authorized mutation layer, realtime connection, and UI.
- Browser E2E covers at least one import and one manual creation entering automatic enrichment, supplied category/nutrition precedence, append behavior, a manually requested replacement, an automatic quiet failure, a manual visible failure, refresh/reconnect lifecycle recovery, and a successful rendered recipe update.
- Existing queue producer/worker tests, repository integration fixtures, recipe subscription/cache tests, and production-like AI browser harness are the prior art to extend rather than replace.
- Completion requires the repository gates: lint, full test run, internationalization check, and production build. Applicable browser E2E and documentation format/build checks are hard gates; an environmentally blocked E2E run is reported as blocked, not passed.

## Out of Scope

- Recipe Provenance, provenance fields, provenance inference, flags, provenance backfill, and provenance-specific UI.
- Persisting whether a stored value came from a human, deterministic parser, AI reader, or enrichment worker.
- Retroactive bulk enrichment or backfill of existing recipes.
- Automatic enrichment after ordinary recipe updates.
- A combined manual `run all enrichments` action.
- A transactional server outbox, durable event replay, periodic enrollment scheduler, coordinator queue, saga, or compensation flow.
- Making Redis Pub/Sub a delivery guarantee; the explicitly accepted brief listener/process loss window remains.
- Replacing BullMQ retry, backoff, retention, failed-job retry, or administrator monitoring semantics.
- A separate persisted recipe-enrichment status or attempt-history schema.
- Periodic client polling for lifecycle recovery.
- Changing the existing recipe validity contract or requiring ingredients, steps, descriptions, or images for persistence.
- Expanding the category taxonomy or Nutrition Information beyond calories, fat, carbohydrates, and protein.
- Redesigning AI providers, model selection, prompt administration, or household allergy management beyond what this flow needs.
- Refactoring the calendar integration; it is architectural precedent only.

## Further Notes

- The design deliberately deepens six modules: extraction, creation, coordination, queue production, worker execution, and repository persistence. The coordinator is the high-leverage policy seam; repository operations concentrate the destructive write semantics.
- The event/listener structure follows the calendar integration, with two corrections needed for this flow: internal enrollment must not depend on client visibility policy, and listener readiness must not be reported before subscription succeeds.
- The four candidate improvements from the architecture review are all represented: centralized enrichment planning, separation of source extraction from inference, concentrated append/replace persistence semantics, and one lifecycle/status interface.
- Current auto-tagging and allergy producers conflate automatic settings with queue admission. That logic moves upward into origin-aware coordination so manual use can remain available.
- Current per-kind status reads and subscriptions are transitional. The target is one contract and one client integration point, while the jobs remain independent.
- The accepted non-durable event window means “automatic” is an operational expectation during normal server runtime, not an exactly-once delivery guarantee. Deterministic automatic job identity provides at-most-one effective enrollment after any delivered duplicate event.
- Specification status does not imply implementation. Production code, migration, documentation, and tests remain to be completed in follow-on tickets or implementation work.
