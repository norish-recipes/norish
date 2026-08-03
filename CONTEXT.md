# Norish

Self-hostable recipe manager and meal planner: recipes, groceries, stores, and a meal calendar shared across a household, served by a single self-hosted backend with web and mobile clients.

## Language

### Recipes

**Usable Recipe**:
A recipe whose creation transaction has succeeded and whose stored state can be loaded. Automatic enrichment adds no second completeness check beyond the existing creation contract.
_Avoid_: Complete Recipe (suggests optional fields must be present)

**Recipe Enrichment**:
Optional AI-assisted processing that adds or refreshes recipe tags, allergy indications, meal categories, nutrition values, provenance, or Step Ingredients after a recipe is usable. It includes both automatic runs for newly usable recipes and manually requested runs; its outcome does not determine whether recipe creation or import succeeded.
_Avoid_: Post-Import Enrichment (excludes manual creation and manual runs)

**Automatic Recipe Enrichment**:
Recipe Enrichment enrolled once for every newly usable recipe, whether created manually or through any import path, according to deployment settings and safely supplied recipe data. Later recipe edits do not enroll it again. It is quiet background work: failure neither changes recipe creation or import success nor presents an operational error to the user.
_Avoid_: Auto-enhancement

**Automatic Enrichment Enrollment**:
The post-commit event-driven handoff from a usable recipe to its eligible Automatic Recipe Enrichment jobs. A listener is part of the normal server runtime, but the event is not persisted or replayed; a brief process or Redis interruption can therefore miss enrollment by accepted design.
_Avoid_: Scheduled enrichment, Enrichment saga

**Manual Recipe Enrichment**:
A single enrichment explicitly requested by a recipe editor. Its lifecycle remains visible and a terminal failure is reported to the requester.

**Supplied Recipe Data**:
Recipe information intentionally entered by a person or explicitly present in an import source and stored with the recipe. Substantive supplied categories, Nutrition Information, or Recipe Provenance suppress the corresponding Automatic Recipe Enrichment; null and empty values do not. AI may read source material to extract supplied facts, but information inferred beyond the source is Recipe Enrichment.

**Imported Recipe Data**:
Supplied Recipe Data explicitly present in an import source and preserved during import. It remains imported data even when AI is required to read the source.
_Avoid_: AI-imported data (describes the mechanism, not the source evidence)

**Nutrition Information**:
A recipe's calories, fat, carbohydrates, and protein considered as one atomic group. Blank values are absent; any substantive supplied value makes the stored group authoritative for Automatic Recipe Enrichment.
_Avoid_: Macros (does not include calories)

**Recipe Provenance**:
Where a recipe comes from: a single origin country, an optional finer-grained region within it, its Cuisines, and a short written explanation of how that was concluded. A dish claimed by several countries still gets the single strongest claim, with rivals acknowledged in the explanation; only a genuinely unplaceable dish has no country. The country's written name, the region, and the explanation are recipe content, not interface chrome: they speak the language of the recipe itself when inferred (or the supplier's own words when supplied) and are never translated. Flags, pickers, and tooltips are chrome and follow the reader's language. It is one kind of Recipe Enrichment.
_Avoid_: Origin (names only one part), Provenance Inference (names the process, not the data)

**Cuisine**:
A named culinary style a recipe belongs to, drawn from a controlled vocabulary that an administrator owns — extended by them directly, or by AI only under an explicitly permissive strategy setting. A recipe may carry several, so fusion dishes remain describable. A Cuisine name is a canonical identifier shown verbatim in every locale, never a translated label.
_Avoid_: Cuisine Tag (a Tag is open, a Cuisine is curated), Category (that is the meal-time taxonomy)

**Tag**:
A free-form keyword attached to a recipe, mintable by anyone and by AI. Tags are an open folksonomy and deliberately overlap other taxonomies; Cuisines and Categories are the curated lists.

**Step Ingredient**:
A step's use of one of the recipe's ingredient lines, carried as a fractional share of that line (half the water is 0.5, "the spices" is several lines at their full share). An amount is entry vocabulary, not a stored form: the editor and the AI claim both accept "3 of the 5 eggs", and it becomes the equivalent share (0.6) at entry time. The step's prose is never rewritten to express it; readers see the resolved names and amounts presented with the step. Amounts are always derived from the ingredient line at the moment of display, so they follow edits and the active measurement system.
_Avoid_: Ingredient Link (suggests a hyperlink in the text rather than a usage relation), Cooklang (names a foreign syntax Norish does not use)

**Ingredient Linking**:
The Recipe Enrichment kind that infers Step Ingredients. It is a gap-filler in every case — automatic or manual, it only ever adds links to steps that have none, so it can never replace or remove what a person attached and needs no supplied-data suppression: a step that already has Step Ingredients is simply not its business. Heading rows are never linked. A step that genuinely uses nothing stays bare and may be examined again by later runs.

### Connectivity & Offline

**Offline**:
The state in which the web client cannot reach the Norish backend — because the client lost its network, the backend is down or unreachable, or it was forced via the (development-only) Offline Toggle. Not synonymous with "no internet".
_Avoid_: disconnected (that is the WebSocket status, a narrower thing)

**Live**:
The state in which the web client can reach the Norish backend and data exchange is permitted. Live does not require the realtime channel to be up — reaching the backend at all is what counts.
_Avoid_: online (ambiguous with general internet connectivity)

**App Shell**:
The static assets (HTML, JS, CSS, fonts, icons) required to boot the web app without any backend response.

**Offline Cache**:
The personalized persisted copy of previously fetched server data that the web app serves while Offline. It contains at minimum the Warm Set, treats everything else as best-effort, and excludes both the mutation Outbox and the static App Shell.

**Warm Set**:
The content guaranteed to be in the Offline Cache: the 50 most recent recipes in full (each with its primary image; further gallery images and videos are excluded from the guarantee), all groceries (including recurring) and stores, and the calendar's initial view window (roughly the current week on desktop, two weeks back/forward on mobile — enough to see the coming week's planned days). The Warm Set is a guaranteed floor — anything else fetched while Live is kept best-effort. A recipe the user creates joins the Warm Set on create (ADR-0008), so it is offline-available immediately rather than only at the next warm.

**Cache Warmer**:
The background process that, while Live, tops the Offline Cache up until the Warm Set is present.

**Offline Toggle**:
A development-only debug affordance that forces Offline, faithfully blocking every backend exchange (probes, realtime, refetches, Replay) at the transport layer so the offline runtime can be exercised without taking the backend down. Gated out of production builds; persists across reloads; cleared only by an explicit action. Not a shipped user control (ADR-0007).

**Recovery**:
The process that makes the Live view trustworthy whenever queued work may exist: initial Live startup, return from Offline, WebSocket reconnection, manual synchronization, or automatic retry continuation. Recovery replays the Outbox to a terminal state, refetches active queries from server truth without clearing their visible cached data, then tops up the Warm Set. Its only public progress state is `isSyncing`.
_Avoid_: Reconnect Sequence (too narrow; Recovery is not limited to an Offline-to-Live transition)

**Outbox**:
The persisted queue of mutations that could not reach the backend, held for Replay. Admission is universal — any mutation qualifies, with no per-feature list. Flows outside the data API (authentication) are outside the Outbox.

**Queued**:
The third outcome of a mutation, beside success and failure: the change is held in the Outbox and presented to the user as tentatively applied. Server-side-effect mutations (e.g. import-from-URL) simply run at Replay time.

**Replay**:
Re-sending Outbox entries, in order, once the backend is reachable again. Replay is idempotent: delivering the same operation twice has no additional effect.

**Parked**:
The state of an Outbox entry that Replay has given up on automatically (deterministic rejection, or retries exhausted). Parked entries stay visible for manual retry or discard; they are never silently dropped. A parked create parks its dependent edits with it.

**Conflicted**:
A Parked flavour: the entry's target changed on the backend while the change waited in the Outbox, so the backend kept the first write and dropped this one (first write wins). The user can reapply by hand.

**Client-Minted Id**:
An entity id generated by the creating client and honoured by the backend, so that changes queued behind a create keep pointing at the right entity across Replay.

### Releases & Docs

**Target Version**:
The version currently being worked toward: the editable docs carry its label, and its release-notes page accrues a short section per feature as work lands.

**Release Checkpoint**:
The maintainer-chosen committed Git boundary for a release, recorded as provenance in its release notes. Executing it freezes the outgoing docs version and advances the editable docs to the next Target Version (ADR-0010).
