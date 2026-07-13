## ADDED Requirements

### Requirement: Persisted web read data is scoped to the authenticated data owner

The web read cache SHALL scope every persisted record to the backend origin, authenticated user ID, household context or membership revision, and cache schema version.

#### Scenario: A different user signs in on the same origin

- **WHEN** a different user signs in on the same browser origin
- **THEN** the previous user's recipe, calendar, grocery, and render-identity snapshots SHALL NOT hydrate for the new user

#### Scenario: The backend origin changes

- **WHEN** the configured backend origin changes
- **THEN** persisted snapshots from the previous origin SHALL be ignored

#### Scenario: Household membership changes

- **WHEN** the authenticated user's household context or membership revision changes
- **THEN** incompatible household-scoped snapshots SHALL be ignored or invalidated before authenticated query consumers render

### Requirement: The canonical offline dataset is persisted

The web client SHALL persist successful canonical snapshots for the first 100 default recipe dashboard summaries, the current local calendar week, and the grocery list including recurring groceries and recipe-name mappings.

#### Scenario: The default recipe list resolves

- **WHEN** the unfiltered default recipe list resolves successfully
- **THEN** the cache SHALL persist the first 100 dashboard summaries and their canonical ordering metadata

#### Scenario: The current local week resolves

- **WHEN** the explicit Monday-to-Sunday current-week calendar query resolves successfully
- **THEN** the cache SHALL persist the planned items, week range, scope metadata, and data timestamp

#### Scenario: The grocery list resolves

- **WHEN** `groceries.list` resolves successfully
- **THEN** the cache SHALL persist groceries, recurring groceries, recipe-name mappings, scope metadata, and a data timestamp

### Requirement: Offline recipe media is limited to dashboard thumbnails

The web client SHALL cache only the thumbnail image associated with each cached dashboard recipe summary. When the thumbnail URL is the same as the recipe's main hero URL, the single cached resource SHALL be reused for both thumbnail and hero rendering. A distinct hero image, gallery image, avatar, video, or other recipe media URL SHALL NOT be fetched or persisted solely for offline use.

#### Scenario: A dashboard thumbnail resolves

- **WHEN** a cached dashboard recipe summary includes a thumbnail URL and that image resolves successfully
- **THEN** the thumbnail response SHALL be persisted in the explicit offline media cache

#### Scenario: The thumbnail is also the main hero image

- **WHEN** the dashboard thumbnail URL equals the recipe's main hero URL
- **THEN** the existing cached thumbnail response SHALL satisfy both thumbnail and hero rendering
- **AND** the client SHALL NOT create a second media-cache entry for the same resource

#### Scenario: A distinct hero or other image URL exists

- **WHEN** a recipe exposes a hero, gallery, avatar, video, or other media URL different from the dashboard thumbnail
- **THEN** that resource SHALL remain online-only and SHALL NOT be added to the offline media cache

### Requirement: Full recipe details are hydrated within a bounded budget

The web client SHALL persist up to 50 complete recipe detail records without blocking foreground interaction. Current-week planned recipes SHALL be prioritized before remaining recipes from the canonical dashboard set. A recipe SHALL only be reported as fully available offline after its complete detail record has been persisted successfully.

#### Scenario: A prioritized recipe detail resolves

- **WHEN** a planned or otherwise prioritized recipe detail resolves successfully during hydration
- **THEN** the complete `recipes.get` record SHALL be persisted and marked offline-ready

#### Scenario: Hydration reaches the detail budget

- **WHEN** 50 complete recipe detail records have been persisted
- **THEN** the hydrator SHALL stop adding lower-priority detail records
- **AND** the canonical dashboard summaries SHALL remain available independently

#### Scenario: Hydration is interrupted

- **WHEN** hydration stops because of connectivity loss, storage pressure, or a terminal recipe error
- **THEN** already persisted recipe details SHALL remain available
- **AND** incomplete records SHALL NOT be reported as fully offline-ready

### Requirement: Selected read cache is restored before authenticated data consumers render

The web client SHALL restore a valid scoped read cache before mounting authenticated query consumers, while keeping the application shell responsive during restoration.

#### Scenario: Cold PWA start with a valid cache and no network

- **WHEN** the installed PWA starts without backend connectivity and a valid scoped cache exists
- **THEN** recipes, the cached current-week plan, and groceries SHALL render from persisted data
- **AND** the UI SHALL identify the data as cached rather than server-confirmed current

#### Scenario: Cold PWA start with network connectivity

- **WHEN** the PWA starts with network connectivity and a valid persisted cache exists
- **THEN** the persisted data SHALL be available before the first authenticated data render
- **AND** stale snapshots SHALL revalidate asynchronously

### Requirement: Offline bootstrap does not weaken server authentication

The offline shell MAY restore the last confirmed render identity, but cached identity, permissions, and read data SHALL NOT authorize a server mutation or replace server-side route authentication.

#### Scenario: Cached identity is available offline

- **WHEN** the backend is unreachable and a last confirmed render identity exists
- **THEN** the client MAY render that identity and its compatible cached read data
- **AND** no cached value SHALL authorize a mutation

#### Scenario: The live session is missing during replay

- **WHEN** an existing queued mutation is replayed without a valid live server session
- **THEN** the server SHALL reject the mutation through the existing authentication boundary
- **AND** the existing outbox SHALL quarantine the entry without replaying it under another user

#### Scenario: No cached application shell exists

- **WHEN** an application navigation fails offline before a safe shell has been cached
- **THEN** the service worker SHALL return a deterministic offline fallback explaining that the app must first be opened online

### Requirement: Personalized API responses are excluded from generic service-worker caching

The service worker SHALL NOT use a generic API GET cache for personalized recipes, groceries, calendar data, auth/session responses, or other user-scoped responses. Personalized offline reads SHALL come from the scoped IndexedDB read cache.

#### Scenario: A personalized API GET is requested

- **WHEN** a user-scoped API GET is requested
- **THEN** the service worker SHALL fetch it without placing it in the generic static/resource cache

#### Scenario: A public static resource is requested

- **WHEN** an explicitly allowlisted static or public resource is requested
- **THEN** the service worker MAY serve or update its dedicated cache according to its resource policy

### Requirement: Cache freshness and persistence failures are visible and truthful

The web client SHALL record data timestamps, cache schema versions, hydration progress, and storage outcomes. It SHALL NOT claim offline availability for a record or snapshot that failed to persist.

#### Scenario: A snapshot is stale but retained

- **WHEN** a retained snapshot exceeds its freshness threshold but remains within its retention window
- **THEN** the UI SHALL render it with a stale or last-synced indication
- **AND** the client SHALL attempt asynchronous revalidation when possible

#### Scenario: Storage quota prevents persistence

- **WHEN** a snapshot or recipe detail cannot be persisted because browser storage quota is insufficient
- **THEN** previously persisted data SHALL remain available
- **AND** the affected snapshot or detail SHALL be reported as unavailable offline rather than falsely successful
