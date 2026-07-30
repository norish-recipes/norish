# Recipe Provenance

Status: ready-for-agent

## Problem Statement

Norish stores what a recipe _is_ — its ingredients, steps, categories, and Nutrition Information — but nothing about where it comes from. A cook browsing a few hundred imported recipes cannot tell which are Italian, which are Thai, and which are the fusion dish they saved after a holiday. Nothing groups a collection by culinary heritage, and nothing tells the story behind a dish.

The information is latent in every recipe already. A title, an ingredient list, and a description are usually enough for a person to say "that's Roman" — and enough for AI to say it too. Today that inference is simply never made, so the collection stays flat.

An earlier attempt (upstream PR 350) built this as a self-contained pipeline: its own queue, its own configuration switches, its own realtime events, its own client hooks, and database writes issued directly from a queue worker. It predates the unified Recipe Enrichment architecture and duplicates all of it, so it cannot ship as written.

A related problem hides underneath. Ten of the predefined auto-tagging Tags are cuisines — `italian`, `mexican`, `thai`, and so on. Cuisine is therefore already recorded, badly: as free-form lowercase Tags minted by AI with no controlled vocabulary, no admin oversight, and no way to browse or filter on them reliably.

## Solution

Recipe Provenance becomes the fifth kind of Recipe Enrichment. It infers where a recipe comes from — an origin country, an optional finer-grained region, its Cuisines, and a short written explanation — and it reaches users through the machinery the other four kinds already use: one coordinator decides eligibility, one queue carries the work, one lifecycle contract reports progress, and one repository operation persists the result.

Cuisine becomes a first-class controlled vocabulary that an administrator owns. It is seeded once by a versioned migration and extended thereafter through admin settings, never by further hand-written migrations. The AI chooses from that vocabulary — or, when configured to, extends it — and its output is always matched against what exists first, so near-misses like "Sicilian" and "Tuscan" land on the row that already means them instead of breeding duplicates.

Cuisine leaves the predefined Tag vocabulary. Auto-tagging stops proposing cuisine Tags, and a one-time migration moves the cuisine Tags already stored onto the new vocabulary.

The written explanation is produced in the language the recipe itself is written in, as part of the same inference. An Italian recipe gets an Italian note beside its Italian steps; a Dutch recipe gets a Dutch one. There is no translation step, no per-locale fan-out, and no dependence on who happens to be reading.

## User Stories

1. As a cook, I want to see which country a recipe comes from, so that I can understand the dish I am about to make.
2. As a cook, I want to see the specific region within that country, so that "Italian" becomes "Roman" when the recipe warrants it.
3. As a cook, I want to see a recipe's Cuisines, so that I can recognise a fusion dish that belongs to more than one tradition.
4. As a cook, I want a short explanation of why a recipe was placed where it was, so that provenance teaches me something instead of just labelling.
5. As a cook, I want the country shown with its flag and its name in my own language, so that provenance reads naturally wherever I live.
6. As a cook, I want the explanation written in the language the recipe is written in, so that it reads alongside the recipe rather than against it.
7. As a cook, I want provenance to appear on a recipe without my asking, so that my collection becomes browsable by origin over time rather than through manual work.
8. As a cook, I want provenance inference never to delay or block saving a recipe, so that importing stays as fast as it is today.
9. As a cook, I want a failed inference to leave my recipe untouched and unmarked, so that a background failure is not my problem.
10. As a recipe editor, I want to correct an inferred origin, so that my grandmother's recipe is attributed to the country I know it came from.
11. As a recipe editor, I want my corrections to survive, so that Automatic Recipe Enrichment never overwrites what I typed.
12. As a recipe editor, I want to request provenance inference on demand, so that a recipe imported before this feature existed can be filled in.
13. As a recipe editor, I want a manual run to replace the whole group, so that a deliberate refresh is not half-blocked by a value I no longer want.
14. As a recipe editor, I want to see that provenance is being worked out right now, so that an empty section reads as "in progress" rather than "nothing found".
15. As a recipe editor, I want a manual run that fails to tell me it failed, so that I know to try again.
16. As a recipe editor, I want to clear provenance entirely, so that a wrong inference can be removed rather than only overwritten.
17. As a recipe editor, I want to choose Cuisines from the vocabulary my deployment uses, so that my manual entries match the ones AI produces.
18. As a household member, I want provenance a housemate corrected to be what I see too, so that we share one answer.
19. As a household member, I want provenance to appear on my screen as soon as it is inferred, so that I do not have to reload.
20. As an Offline user, I want provenance on the recipes in my Warm Set, so that the recipe page is complete without a connection.
21. As an administrator, I want a switch that turns automatic provenance inference on and off, so that it matches the control I have over the other four kinds.
22. As an administrator, I want that switch to be independent of whether editors can request it manually, so that turning off automation does not remove an editing tool.
23. As an administrator, I want to add a Cuisine, so that a tradition my household cooks is representable without waiting for a Norish release.
24. As an administrator, I want to rename a Cuisine, so that correcting a name does not orphan the recipes already using it.
25. As an administrator, I want to delete a Cuisine, so that a mistaken entry can be removed with consequences documented up front.
26. As an administrator, I want to choose whether AI may invent new Cuisines or only pick from mine, so that I decide how much control I keep over the vocabulary.
27. As an administrator, I want AI output matched against my vocabulary before anything is stored, so that "Sicilian" does not become a second row meaning Italian.
28. As an administrator, I want to edit the provenance inference prompt, so that I can tune tone and behaviour like every other AI feature.
29. As an administrator, I want to see provenance jobs in the job monitor, so that failures are diagnosable the same way as the other kinds.
30. As a self-hoster, I want provenance to require no new infrastructure, so that upgrading is an ordinary release.
31. As a self-hoster with AI disabled, I want the feature to be inert rather than broken, so that Norish stays fully usable without an AI provider.
32. As a maintainer, I want provenance to add no new client integration point, so that the lifecycle surface stays one contract rather than two.
33. As a maintainer, I want cuisine Tags migrated onto the new vocabulary, so that the fact is stored in one place after this ships.
34. As a maintainer, I want the migration to record what it removed, so that a destructive step is auditable.
35. As a maintainer, I want provenance to issue no database queries from outside the repository layer, so that the boundary the other kinds respect is not broken by this one.
36. As a contributor, I want provenance to be a worked example of adding an enrichment kind, so that a sixth kind is obvious to build.

## Implementation Decisions

### Kind identity and vocabulary

- Recipe Provenance is added to the Recipe Enrichment kind vocabulary as a fifth member. The lifecycle states, origin values, skip reasons, and enrollment outcomes are reused unchanged.
- The combined status contract continues to return exactly one entry per kind — now five, always five. Provenance does not fan out per locale, per field, or per Cuisine.
- Job identity remains deterministic per recipe and kind. Provenance introduces no locale-keyed or field-keyed job identity, because duplicate coalescing across server instances depends on that invariant.
- Provenance gets its own queue, alongside the four existing enrichment queues, inheriting the shared retry, backoff, and retention options.

### What Recipe Provenance is

- Recipe Provenance is one atomic group: an origin country, an optional origin region, zero or more Cuisines, and a single provenance note.
- The origin country is an ISO-3166-1 alpha-2 code. It is stored as a code, never as a display name, so the client can render it localised.
- The origin region is free text and is not translated. Place names are left as inferred.
- The note is written in the language of the recipe itself. It is one note, not a map: there is no per-locale storage, no translation on the read path, and no second AI request.
- The note's language is not constrained to the deployment's enabled locales. A Japanese recipe gets a Japanese note even though Japanese is not a bundled locale, because the alternative — a note in a language the recipe is not in — reads worse on the page it appears on.
- The note's language is not recorded. The rendered paragraph carries no `lang` attribute, so a note in an unfamiliar language gets no browser translate offer. That is accepted.
- Stored column names and the field names in code agree with each other. The earlier attempt named them inconsistently; that is corrected rather than carried forward.

### Cuisine as a controlled vocabulary

- Cuisines are rows, not a database enum. An enum cannot be extended from a settings form, which is the whole point of admin ownership.
- A Cuisine is an entity with a name and a lifecycle. A recipe's Cuisines are a join, mirroring the existing Tag structure exactly.
- The vocabulary is seeded exactly once, by a versioned migration, so that every later rename and delete is permanent. Seeding is not a boot-time reconcile: a Cuisine an administrator deleted must not reappear at the next restart.
- `Other` is deliberately excluded: as a row it is a null-object that lets the AI avoid choosing and makes filtering meaningless. An empty Cuisine set already means "nothing in our vocabulary fits".
- A Cuisine name is a canonical identifier, not a translatable label. It is stored once, seeded in English, and displayed verbatim to every locale — the same treatment AI-minted Tags already get. There are no translation keys, and there is no distinction between seeded and administrator-created rows at render time. An administrator who wants names in their own language renames them.
- Because names are canonical, the inference prompt must pick cuisine names verbatim from the supplied vocabulary, in the vocabulary's language, whatever language the note is written in. Without that instruction an Italian recipe yields `Italiana` and, under the extending strategy, mints a second row meaning Italian — precisely the near-duplicate the vocabulary exists to prevent.
- Renaming a Cuisine updates one row and every recipe referencing it follows.
- Deleting a Cuisine is a silent cascade: the row and its associations are removed, with no usage count and no confirmation beyond the ordinary one. Recipes that referenced it keep a note that may now argue for a Cuisine no longer listed. That drift is accepted and not repaired.
- A cuisine strategy setting governs how names are chosen: `existing` restricts the AI to the current vocabulary, `extend` permits it to add rows. It defaults to `existing`. The tag strategy's names are deliberately **not** reused — it has three values, and its `predefined` mode names a compile-time list that has no cuisine equivalent.
- The strategy is independent of the automatic switch, following the correction already made for auto-tagging: how names are picked and whether the kind runs automatically are orthogonal axes, and conflating them once already made manual availability depend on automatic policy.
- Under both strategies, proposed names are matched against the existing vocabulary before anything is stored. Under `existing` an unmatched name is dropped; under `extend` it becomes a new row. Matching prevents near-duplicates in both cases.
- Dropped names are returned by the resolver — they are part of its contract and its tests — but nothing consumes them. They are not logged, not persisted, and not surfaced. A recipe whose cuisine was dropped is indistinguishable from one where nothing fitted.

### Cuisine leaves the Tag vocabulary

- The auto-tagging prompt drops its cuisine entries. Cuisine leaves the **predefined** Tag vocabulary.
- It does not leave Tags altogether, and the spec does not claim it does. Free-form cuisine-like Tags a person typed — `sicilian`, `tex-mex`, `levantine` — are folksonomy and stay. Tags are an open dumping ground by design, which is exactly why cuisine needed somewhere else to live.
- A one-time data migration matches existing cuisine Tags against the seeded vocabulary, attaches the corresponding Cuisines to those recipes, and removes the matched Tags — both the `recipe_tags` associations and the now-orphaned `tags` rows. Deleting the rows matters: under the `predefined_db` tag strategy the prompt builder injects every existing tag name back into the auto-tagging prompt as an allowed tag, so a surviving orphan row would keep cuisine in circulation after the migration meant to end it.
- Only matched Tags are removed; every other Tag is untouched.
- The migration records what it removed per recipe, because the removal is not reversible from within the application.
- Tags overlapping other taxonomies elsewhere — notably the meal-time categories — is accepted as-is and explicitly not addressed here.

### Inference

- One AI request produces the entire provenance claim: country, region, Cuisines, and the note.
- The request schema is built at runtime from the current Cuisine vocabulary rather than being a fixed compile-time shape.
- The note is written in the language of the recipe. The prompt infers that language from the recipe text it already has; no separate language-detection step and no stored language field.
- Where a language distinguishes formal and informal register, nothing selects between them. A German recipe may get a `Du` note or a `Sie` one. No locale reaches the prompt, so nothing can decide, and this is accepted rather than handled.
- A failed request is an ordinary retryable AI failure. Because nothing is written until the request succeeds, a retry cannot contradict a claim the user has already seen.
- Inference reads only the stored recipe. It never reads parser output, import metadata, or how the recipe entered Norish.

### Eligibility and precedence

- Recipe Provenance requires ingredients, exactly like the other four kinds, and inherits the coordinator's existing blanket pre-check unchanged. The coordinator is not refactored for this feature. A recipe with a title and no ingredients is skipped with `insufficient-input`, for provenance and for everything else.
- Substantive Recipe Provenance is Supplied Recipe Data. Any substantive value in the group — country, region, Cuisines, or note — suppresses Automatic Recipe Enrichment for the whole group, following the atomic precedent set by Nutrition Information.
- Atomicity is deliberate. The note explains the whole claim; letting AI fill Cuisines beside a human-set country would store a paragraph arguing against the field next to it.
- A Manual Recipe Enrichment run replaces the entire group regardless of what is stored, because a manual request is a deliberate refresh.
- Whether a stored value came from a person or from a worker is still not recorded. Once provenance exists by any route, automatic inference does not run again for that recipe — the same behaviour categories and Nutrition Information already have.

### Persistence

- One repository operation writes the whole group atomically: the scalar fields, the note, and the Cuisine join rows. Partial application is not possible.
- Automatic runs write conditionally, deferring to Supplied Recipe Data that appeared while the job was in flight. Manual runs write unconditionally.
- All database access is issued from the repository layer. Queue workers hold no database handle and compose no queries, which is the boundary the earlier attempt crossed.
- Empty or failed AI output never erases stored provenance.
- Clearing provenance is an explicit editor action, distinct from an enrichment run writing an empty result.

### Configuration

- A fifth automatic switch joins the existing four, with the same independence from manual availability. It defaults **off**, following the precedent that an upgrade must not silently start spending AI.
- The cuisine strategy is a separate setting from that switch.
- No locale setting is introduced, and the enabled-locale list does not reach the inference path at all.
- The inference prompt is administrator-editable through the existing prompt administration surface.

### Client and UI

- Provenance renders on the recipe detail page: the country's flag, its name localised through the platform's region display names, the region, the Cuisines, and the note as stored.
- The section is absent when there is no provenance and no run in progress, so recipes that will never have it show nothing.
- Provenance is editable in the recipe form as one atomic group, alongside the other enrichable fields.
- Lifecycle progress rides the single existing enrichment contract. No new subscription, no new status query, and no new client integration point.
- All new interface work uses the HeroUI version the application is on. The earlier attempt's component predates it and is treated as a description of what to show, not as code to port.
- Administration gains Cuisine management — list, add, rename, delete — plus the strategy control and the automatic switch.
- Translation strings are added for every enabled locale. This covers interface chrome only; the note itself is recipe content and is never translated.

### Offline

- Provenance is part of the recipe, so it travels into the Offline Cache and the Warm Set with the recipe and needs no separate warming.
- The note is stored with the recipe, so an Offline user sees exactly what a Live user sees. Nothing about provenance depends on having viewed the recipe while Live.

## Testing Decisions

- Tests assert observable decisions and stored outcomes through the highest practical seam. They must not assert private helper call order or internal module layout.
- Existing seams are extended rather than replaced. The coordinator interface, repository integration fixtures, worker tests, combined-status tests, client hook tests, and the production-like AI browser harness are all prior art for this work.
- The primary seam is the Recipe Enrichment coordinator interface. Feed it a persisted recipe, configuration, and origin; observe typed per-kind enrollment results.
- Coordinator tests cover provenance eligibility with and without ingredients, the automatic switch in both positions, atomic supplied-provenance precedence, manual runs ignoring the automatic switch, and global AI disabled. Because the coordinator is not refactored, the four existing kinds need no regression coverage beyond what they already have.
- The cuisine resolver is the second seam and is a pure function: proposed names, strategy, and current vocabulary in; resolved rows, newly created names, and dropped names out. It is tested without a database and without AI, covering exact matches, case and whitespace differences, near-miss matching under both strategies, unmatched names under both strategies, duplicate proposals collapsing to one row, and an empty proposal set.
- Repository integration tests use a real database and verify atomic writes across scalar fields, note, and join rows; conditional automatic replacement deferring to supplied data; unconditional manual replacement; no-op behaviour on failed validation; and that a failed write leaves no partial group.
- Inferrer tests mock only the external AI provider. They verify that the request schema is built from the current vocabulary, that cuisine names are taken verbatim from that vocabulary rather than translated into the recipe's language, that the note comes back in the recipe's language for at least two different recipe languages, and that an unparseable response fails without writing.
- Worker tests verify validated persistence, retry on transient failure, terminal lifecycle failure, canonical recipe update emission, and origin-aware notification. They also assert the worker composes no queries of its own.
- Queue tests verify deterministic automatic identity, repeatable manual identity, active duplicate detection, and that provenance does not disturb the identity or independence of the other four queues.
- Combined-status tests verify the contract returns five kinds, that provenance maps retained job state onto the shared lifecycle states, and that removed history returns provenance to idle.
- Migration tests verify that matched cuisine Tags produce the corresponding Cuisines, that both their associations and their orphaned tag rows are removed, that unmatched Tags survive untouched, that recipes with no cuisine Tags are unaffected, that the removal is recorded, and that re-running the migration is a no-op.
- Administration tests cover creating, renaming, and deleting a Cuisine, verify that a rename requires no recipe writes, and verify that a delete cascades to the join rows without touching the recipes themselves.
- Seeding tests verify that the seed runs once and that a deleted Cuisine does not reappear after a subsequent startup.
- Client hook tests verify that provenance lifecycle and canonical recipe updates flow through the existing enrichment contract with no provenance-specific subscription.
- UI tests verify the section is absent with no provenance and no active run, the in-progress state, localised country rendering, editing the group, and clearing it.
- Production-like browser E2E extends the existing AI harness: mock only the external AI provider while using the real server, database, Redis, workers, repositories, authorized mutation layer, realtime connection, and UI. It covers an import entering automatic provenance inference, supplied-provenance precedence, a manual replacement, a quiet automatic failure, and a rendered recipe update.
- Completion requires the repository gates: lint, full test run, internationalization check, and production build. Applicable browser E2E and documentation checks are hard gates; an environmentally blocked E2E run is reported as blocked, not passed.

## Out of Scope

- Backfilling provenance for recipes that already exist. Deferred rather than rejected: it collides with the automatic switch, because backfill would enroll automatic-origin runs and the coordinator refuses those whenever the kind's switch is off — which is its default. Manual on-demand inference is the only path for a pre-existing recipe. This keeps the exclusion recorded in the Recipe Enrichment spec intact.
- Recording which language a provenance note was written in, and anything that would depend on knowing it.
- Translating the note, the origin region, or any other free-text recipe content, on demand or otherwise.
- Persisting whether a stored provenance value came from a person, an importer, or a worker.
- A pending or approval workflow for AI-proposed Cuisines. Under `extend` new rows are created directly; under `existing` unmatched names are dropped.
- Surfacing, logging, or persisting unmatched cuisine suggestions. Discovering that a Cuisine is missing stays a manual observation.
- Merging two Cuisines into one as an administrative operation.
- Repairing notes that argue for a Cuisine an administrator later deleted.
- Browsing, filtering, searching, or grouping recipes by Cuisine or origin. This spec stores and displays provenance; navigation by it is a separate feature.
- Cuisine-based meal planning, suggestions, or recommendations.
- Removing the duplication between Tags and the meal-time categories.
- Removing the deprecated auto-tagging configuration fields, which remain the upgrade path for deployments running the current release.
- Backfill for the four existing enrichment kinds.
- Changing the recipe validity contract, or requiring provenance for persistence.
- Redesigning AI providers, model selection, or prompt administration beyond what this flow needs.

## Further Notes

- Upstream PR 350 is a source of material, not a branch to merge. It conflicts, predates the Recipe Enrichment architecture, duplicates the coordinator, lifecycle, configuration, and client layers, and issues database writes from a queue worker. Harvest its prompt, its starting cuisine list, its translations, and its localised country rendering; discard its queue, producer, worker, configuration, router, and hooks.
- The feature deepens one new module — the cuisine resolver — and extends five existing ones. The resolver is the high-leverage seam: strategy, matching, deduplication, and creation all sit behind one pure interface, which is why it can be tested exhaustively without a database or an AI provider.
- Adding a fifth kind is the first real test of whether the Recipe Enrichment architecture generalises. Anywhere provenance needs a special case in the coordinator, the lifecycle, or the client is a place the abstraction leaked, and is worth noticing rather than working around. The coordinator survives this feature untouched, which is evidence in its favour.
- Cuisine and Tag deliberately share a shape and differ in governance: Tags are minted freely by anyone including AI, Cuisines only by administrators or by an explicitly permissive strategy. That similarity is recorded as an ADR, because two near-identical table pairs will otherwise read as an accident.
- Cost is one AI request per recipe, independent of how many locales a deployment enables. An earlier draft generated the note in every enabled locale, which cost thirteen notes per recipe by default and would have been Norish's first per-locale content storage.
- The atomic precedence group means provenance is effectively write-once per recipe unless someone requests a refresh. That is the same shape as Nutrition Information and is intentional, but it does mean a vocabulary change does not retroactively improve recipes already inferred — and with backfill out of scope, the only remedy is a manual run per recipe.
- Specification status does not imply implementation. Production code, migrations, documentation, and tests remain to be completed in follow-on tickets.
