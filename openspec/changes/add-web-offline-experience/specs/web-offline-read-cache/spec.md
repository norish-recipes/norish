## ADDED Requirements

### Requirement: Web offline cache is scoped to the authenticated data owner

The web offline cache SHALL scope every persisted record to the backend origin, authenticated user ID, household context or membership revision, and cache schema version.

#### Scenario: User changes on the same origin

- **WHEN** a different user signs into the same browser origin
- **THEN** the previous user's recipe, meal-plan, grocery, and render-identity records SHALL NOT hydrate for the new user

#### Scenario: Backend origin changes

- **WHEN** the configured backend origin changes
- **THEN** persisted data from the previous origin SHALL NOT be used

### Requirement: Canonical offline snapshots are persisted

The web client SHALL persist successful canonical snapshots for the first 100 recipes, the current calendar week, and the grocery list.

#### Scenario: Canonical recipe list resolves

- **WHEN** the unfiltered default recipe list resolves successfully
- **THEN** the cache SHALL persist the first 100 recipe IDs and dashboard records using the canonical default sort

#### Scenario: Weekly meal plan resolves

- **WHEN** the exact current-week `calendar.listItems` query resolves successfully
- **THEN** the cache SHALL persist the returned planned items with their week range and data timestamp

#### Scenario: Grocery list resolves

- **WHEN** `groceries.list` resolves successfully
- **THEN** the cache SHALL persist groceries, recurring groceries, and recipe-name mappings with a data timestamp

### Requirement: Full recipe details are hydrated in bounded background batches

The web client SHALL hydrate and persist full recipe detail records for the canonical first 100 recipes without blocking foreground interaction. A recipe SHALL only be reported as fully available offline after its detail record has been persisted successfully.

#### Scenario: Recipe detail hydration succeeds

- **WHEN** a recipe detail query resolves successfully during hydration
- **THEN** the full recipe record SHALL be persisted and marked available offline

#### Scenario: Recipe detail hydration is incomplete

- **WHEN** hydration stops because of connectivity, quota, or a terminal recipe error
- **THEN** completed recipe records SHALL remain available
- **AND** incomplete records SHALL NOT be presented as fully available offline

### Requirement: Persisted cache is restored before authenticated query consumers render

The web client SHALL restore a valid persisted cache before mounting authenticated query consumers, while keeping the application shell responsive during restore.

#### Scenario: Cold start with a valid cache and no network

- **WHEN** the installed PWA starts without network connectivity
- **THEN** the authenticated data tree SHALL hydrate from persisted snapshots
- **AND** recipes, current-week meals, and groceries SHALL render without requiring a live query response

#### Scenario: Cold start with a valid cache and network

- **WHEN** the PWA starts with network connectivity
- **THEN** persisted snapshots SHALL be available before the first authenticated data render
- **AND** stale snapshots SHALL revalidate asynchronously

### Requirement: Offline navigation has a safe app-shell fallback

The service worker SHALL provide a cached application shell for failed same-origin navigation requests so an installed PWA can reopen while the backend is unavailable.

#### Scenario: Authenticated navigation fails offline

- **WHEN** a navigation request for an application route fails because the origin is offline
- **THEN** the service worker SHALL return the safe cached application shell
- **AND** the client SHALL boot into offline mode without weakening the server-side auth proxy

#### Scenario: No app shell exists

- **WHEN** navigation fails offline before a safe shell has been cached
- **THEN** the service worker SHALL return a deterministic offline fallback explaining that the app must be opened online once before offline use is available

### Requirement: Offline render identity is not authorization

The client MAY restore the last confirmed user identity for offline rendering, but SHALL require the current server session for replayed writes and SHALL revalidate the identity when connectivity returns.

#### Scenario: Cached identity is available offline

- **WHEN** the backend is unreachable and a last confirmed user identity exists
- **THEN** the avatar and cached data may render for that identity
- **AND** no cached identity or permission SHALL authorize a server mutation

#### Scenario: Reconnect identity differs

- **WHEN** reconnect session validation returns a different user or no user
- **THEN** the old identity's cached data SHALL be cleared or isolated
- **AND** queued mutations for the old identity SHALL remain quarantined

### Requirement: Cached snapshots expose freshness and handle storage pressure

The web client SHALL record snapshot timestamps, cache schema versions, and storage outcomes, and SHALL not claim durable availability when persistence fails.

#### Scenario: Snapshot is stale but usable

- **WHEN** a persisted snapshot exceeds its freshness threshold but remains within its retention window
- **THEN** the UI SHALL render it with a stale/last-updated indication
- **AND** the client SHALL attempt background revalidation when possible

#### Scenario: Storage quota is exceeded

- **WHEN** a recipe, media asset, or query snapshot cannot be persisted because of quota
- **THEN** the client SHALL retain already-persisted data
- **AND** SHALL mark the affected record unavailable offline rather than reporting false success

