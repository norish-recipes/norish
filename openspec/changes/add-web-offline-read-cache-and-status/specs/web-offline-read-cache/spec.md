## ADDED Requirements

### Requirement: The web read cache persists only an explicit bounded dataset

The web client SHALL persist only successful reads needed for the primary offline experience: the first page of the default recipe dashboard with its normal limit of 100, up to 50 most-recently-used complete recipe details, the latest successful calendar range requested by the calendar screen, `groceries.list`, and `stores.list`. The grocery snapshot SHALL include recurring groceries and recipe-name mappings already returned by `groceries.list`. The cache MAY also retain the minimal last-confirmed user and household render metadata needed to select a compatible scope and mount the offline application chrome. The client SHALL NOT issue background requests solely to fill this cache.

#### Scenario: An allowlisted read succeeds

- **WHEN** an allowlisted recipe, calendar, grocery, or store query completes successfully
- **THEN** the client SHALL persist its data, exact consumer query identity, data timestamp, and cache-scope metadata

#### Scenario: Recipe detail retention reaches its limit

- **WHEN** a fifty-first complete recipe detail becomes eligible for persistence
- **THEN** the least-recently-used detail SHALL be evicted
- **AND** the dashboard, calendar, grocery, and store snapshots SHALL remain intact

#### Scenario: A non-canonical query succeeds

- **WHEN** an admin query, auth response, transient search/filter result, or other non-allowlisted query succeeds
- **THEN** the read cache SHALL NOT persist that query

#### Scenario: A detail was not opened or prefetched normally

- **WHEN** a recipe detail has not been fetched through normal application use
- **THEN** the read-cache layer SHALL NOT fetch it merely to increase offline coverage

#### Scenario: Offline chrome needs a render identity

- **WHEN** the live session and household endpoints are unreachable during a compatible cached launch
- **THEN** the client MAY use the last-confirmed minimal user and household metadata to mount the application chrome
- **AND** it SHALL label that identity as render-only rather than authenticated live state

### Requirement: Persisted reads are isolated by data owner and schema

Every read-cache record SHALL be keyed by backend origin, last confirmed user ID, last confirmed household ID or equivalent household scope, and read-cache schema version. Cached identity SHALL select render-only offline data and SHALL NOT authorize any request.

#### Scenario: The same user starts the app offline

- **WHEN** live session and household requests are unreachable and a last-confirmed scope has a compatible snapshot
- **THEN** the client MAY select that snapshot for render-only fallback
- **AND** it SHALL continue to treat the server session as authoritative for all mutations

#### Scenario: A different user is confirmed online

- **WHEN** a live session confirms a user other than the last-confirmed cached user
- **THEN** the previous user's records SHALL NOT hydrate into the new user's QueryClient
- **AND** the active cached scope SHALL switch only after the new user's household scope is confirmed

#### Scenario: Sign-out is confirmed

- **WHEN** the backend confirms that the session has signed out
- **THEN** the last-confirmed render scope SHALL be removed
- **AND** private cached data SHALL NOT render on a later anonymous launch

#### Scenario: Origin, household, or schema changes

- **WHEN** the backend origin, confirmed household scope, or read-cache schema version differs from a persisted record
- **THEN** that record SHALL be ignored as incompatible

### Requirement: Fresh loads try the backend before showing cached reads

On every fresh application load, the normal TanStack Query consumers SHALL make a live backend attempt before compatible IndexedDB data is shown. Existing route and component skeleton loaders SHALL remain visible during this attempt. IndexedDB metadata MAY be prepared concurrently, but cached payloads SHALL NOT replace a pending live request before the live attempt fails or reaches the bounded reachability deadline.

#### Scenario: The backend responds on a fresh load

- **WHEN** the initial live queries complete successfully
- **THEN** the screens SHALL render the live responses
- **AND** compatible persisted data SHALL NOT overwrite those responses
- **AND** the successful responses SHALL refresh the read cache asynchronously

#### Scenario: The backend is unreachable on a fresh load

- **WHEN** the initial live attempt fails with an offline, transport, or backend-unavailable result, or reaches the bounded reachability deadline
- **THEN** the client SHALL load the latest compatible snapshot from IndexedDB
- **AND** it SHALL seed the exact query keys used by the current screen
- **AND** the existing skeleton SHALL remain visible until either live data or cached data resolves

#### Scenario: A request returns an authorization or validation error

- **WHEN** the backend responds with a confirmed authentication, authorization, or request-validation error
- **THEN** the client SHALL follow the normal live error/authentication flow
- **AND** it SHALL NOT classify that response as an offline-cache fallback condition

#### Scenario: No compatible cache exists

- **WHEN** the initial backend attempt is unreachable and no compatible snapshot exists
- **THEN** the skeleton SHALL resolve to an explicit unavailable-offline state
- **AND** the screen SHALL NOT present an empty dataset as though it were a successful live response

### Requirement: Restored data matches the existing screen query contracts

The fallback SHALL restore data under the current screen's real TanStack Query identities. The recipe snapshot SHALL use the shared default dashboard filter contract; recipe details SHALL use `recipes.get` identities; calendar data SHALL use the requested range identity stored with the snapshot; and grocery data and stores SHALL use their existing list identities.

#### Scenario: The recipe dashboard falls back

- **WHEN** the default recipe dashboard's live request is unreachable and its compatible snapshot exists
- **THEN** the first 100 persisted summaries SHALL render through the existing recipes context
- **AND** the screen SHALL identify them as cached with a last-updated time

#### Scenario: A cached recipe detail is opened

- **WHEN** `recipes.get` cannot reach the backend and a compatible complete detail exists
- **THEN** the normal recipe-detail screen SHALL render that detail after its existing skeleton

#### Scenario: An uncached recipe detail is opened offline

- **WHEN** `recipes.get` cannot reach the backend and no complete persisted detail exists
- **THEN** the recipe-detail skeleton SHALL resolve to a clear unavailable-offline state

#### Scenario: Calendar, groceries, or stores fall back

- **WHEN** one of those screens cannot reach the backend and its matching compatible snapshot exists
- **THEN** the existing context SHALL render the cached payload without inventing a second query-key format

### Requirement: Failed reads cannot replace the last successful snapshot

Only complete successful allowlisted results SHALL advance persisted records. Query errors, aborted requests, retry state, and partial writes SHALL leave the last successful record intact. Persistence failures SHALL be observable without making cached data a prerequisite for normal online use.

#### Scenario: A refresh fails after a successful cache fill

- **WHEN** a later background or foreground refresh fails because the backend is unreachable
- **THEN** the previous successful snapshot SHALL remain durable

#### Scenario: IndexedDB is unavailable or quota is exceeded

- **WHEN** a cache write fails because IndexedDB is unavailable, blocked, or out of quota
- **THEN** the live response SHALL remain usable in memory
- **AND** the affected data SHALL be reported as not available offline
- **AND** previously committed compatible records SHALL not be deleted by the failed write

#### Scenario: A cache write is interrupted

- **WHEN** a tab closes or an IndexedDB transaction aborts before commit
- **THEN** the previous committed record SHALL remain the fallback record

### Requirement: Cached fallback pauses live retries and converges after recovery

After fallback data is installed, automatic retries for affected read queries SHALL pause while connectivity is offline or backend-unreachable. When a live recovery check succeeds, the existing mutation outbox SHALL receive the recovery signal before authoritative read refetch completes, and successful live reads SHALL replace the cached view.

#### Scenario: Cached data is being displayed during an outage

- **WHEN** the connectivity state remains offline or backend-unreachable
- **THEN** affected queries SHALL not continuously retry in the background
- **AND** the cached screen SHALL remain interactive for supported local/queued actions

#### Scenario: Connectivity recovers with queued writes

- **WHEN** a live recovery check succeeds while the mutation outbox contains replayable writes
- **THEN** replay SHALL start through the existing outbox coordinator
- **AND** authoritative active-query refetch SHALL occur after that replay pass settles

#### Scenario: A recovery refetch succeeds

- **WHEN** an authoritative refetch returns current server data
- **THEN** that data SHALL replace the cached view
- **AND** it SHALL refresh the persisted successful snapshot and last-live-success time

### Requirement: Cold PWA navigation can start the client fallback safely

The service worker SHALL use network-first document navigation and retain only confirmed same-origin application shells and the runtime scripts/styles needed to hydrate them. It SHALL cache an application route only after a successful online response, use an exact matching route shell when available, and otherwise show a deterministic offline fallback. Personalized API responses and generic recipe/user images SHALL not be stored by the service worker.

#### Scenario: A previously confirmed route is opened cold while offline

- **WHEN** document navigation cannot reach the server and an exact confirmed route shell plus its required runtime assets are cached
- **THEN** the service worker SHALL return that shell
- **AND** the client SHALL run the live-first attempt and IndexedDB fallback flow

#### Scenario: No confirmed route shell exists

- **WHEN** document navigation cannot reach the server and no exact confirmed shell is available
- **THEN** the service worker SHALL return an offline fallback explaining that the route must first be opened online

#### Scenario: A personalized API GET is requested

- **WHEN** a same-origin API GET handles auth, recipes, calendar, groceries, stores, or other user data
- **THEN** the service worker SHALL not put that response into Cache Storage

#### Scenario: An arbitrary image is requested

- **WHEN** an avatar, recipe, gallery, or other content image loads
- **THEN** the service worker SHALL not cache it solely because its request destination is `image`

### Requirement: Users can inspect and clear their active read cache

The read-cache layer SHALL expose a summary for the active scope containing record counts, data timestamps, last successful live contact, schema version, and persistence warnings. Clearing cached reads SHALL require confirmation and SHALL affect only the active read-cache scope, never the mutation outbox.

#### Scenario: Cache inventory is requested

- **WHEN** the offline-status surface requests the active cache summary
- **THEN** it SHALL receive separate counts and timestamps for recipe summaries, complete recipe details, calendar items, groceries, recurring groceries, and stores

#### Scenario: The user clears cached reads

- **WHEN** the user confirms the clear-cache action
- **THEN** all read-cache records for the active origin/user/household scope SHALL be removed
- **AND** queued mutations and retained delivery results SHALL remain untouched
