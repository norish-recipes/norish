# Norish

Self-hostable recipe manager and meal planner: recipes, groceries, stores, and a meal calendar shared across a household, served by a single self-hosted backend with web and mobile clients.

## Language

### Recipes

**Usable Recipe**:
A recipe whose creation transaction has succeeded and whose stored state can be loaded. Automatic enrichment adds no second completeness check beyond the existing creation contract.
_Avoid_: Complete Recipe (suggests optional fields must be present)

**Recipe Enrichment**:
Optional AI-assisted processing that adds or refreshes recipe tags, allergy indications, meal categories, or nutrition values after a recipe is usable. It includes both automatic runs for newly usable recipes and manually requested runs; its outcome does not determine whether recipe creation or import succeeded.
_Avoid_: Post-Import Enrichment (excludes manual creation and manual runs), Recipe Provenance (a separate, unimplemented feature)

**Automatic Recipe Enrichment**:
Recipe Enrichment enrolled once for every newly usable recipe, whether created manually or through any import path, according to deployment settings and safely supplied recipe data. Later recipe edits do not enroll it again. It is quiet background work: failure neither changes recipe creation or import success nor presents an operational error to the user.
_Avoid_: Auto-enhancement

**Automatic Enrichment Enrollment**:
The post-commit event-driven handoff from a usable recipe to its eligible Automatic Recipe Enrichment jobs. A listener is part of the normal server runtime, but the event is not persisted or replayed; a brief process or Redis interruption can therefore miss enrollment by accepted design.
_Avoid_: Scheduled enrichment, Enrichment saga

**Manual Recipe Enrichment**:
A single enrichment explicitly requested by a recipe editor. Its lifecycle remains visible and a terminal failure is reported to the requester.

**Supplied Recipe Data**:
Recipe information intentionally entered by a person or explicitly present in an import source and stored with the recipe. Substantive supplied categories or Nutrition Information suppress the corresponding Automatic Recipe Enrichment; null and empty values do not. AI may read source material to extract supplied facts, but information inferred beyond the source is Recipe Enrichment.

**Imported Recipe Data**:
Supplied Recipe Data explicitly present in an import source and preserved during import. It remains imported data even when AI is required to read the source.
_Avoid_: AI-imported data (describes the mechanism, not the source evidence)

**Nutrition Information**:
A recipe's calories, fat, carbohydrates, and protein considered as one atomic group. Blank values are absent; any substantive supplied value makes the stored group authoritative for Automatic Recipe Enrichment.
_Avoid_: Macros (does not include calories)

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
