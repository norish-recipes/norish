## ADDED Requirements

### Requirement: Query cache is persisted to MMKV storage

The mobile app SHALL persist the TanStack Query cache to a dedicated MMKV storage instance so that cached query data survives app restarts and is available during offline cold starts.

#### Scenario: Cache written to MMKV after queries resolve

- **WHEN** a query resolves successfully
- **THEN** the persister SHALL serialize the updated query cache to the MMKV instance with key `norish-query-cache`

#### Scenario: Cold start without network

- **WHEN** the app starts with no network connectivity
- **THEN** the persisted cache SHALL be hydrated into the `QueryClient` before authenticated query consumers render
- **AND** previously-fetched queries SHALL resolve from the cache instead of failing

#### Scenario: Cold start with network

- **WHEN** the app starts with network connectivity
- **THEN** the persisted cache SHALL be hydrated first before authenticated query consumers render
- **AND** stale queries SHALL refetch from the server in the background

---

### Requirement: Persisted cache has a maximum age

The persisted query cache SHALL be discarded if it is older than a configured maximum age to prevent serving very stale data.

#### Scenario: Cache within max age

- **WHEN** the persisted cache was written less than 24 hours ago
- **THEN** it SHALL be hydrated normally on cold start

#### Scenario: Cache exceeds max age

- **WHEN** the persisted cache is older than 24 hours
- **THEN** the persister SHALL discard the cache and start fresh

---

### Requirement: Cache is invalidated on app version change

The persisted cache SHALL include a version buster that invalidates the cache when the app version changes, preventing deserialization errors from schema changes.

#### Scenario: App version unchanged

- **WHEN** the app starts and the cache buster matches the current app version
- **THEN** the cache SHALL be hydrated normally

#### Scenario: App version changed

- **WHEN** the app starts and the cache buster does not match the current app version
- **THEN** the persister SHALL discard the stale cache

---

### Requirement: Cache uses a dedicated MMKV instance

The query cache persister SHALL use a separate MMKV instance (not the general-purpose `norish-storage` instance) to isolate cache data from other stored state.

#### Scenario: Cache MMKV instance is independent

- **WHEN** the query cache is cleared or corrupted
- **THEN** user preferences and other data in the general MMKV instance SHALL NOT be affected

---

### Requirement: Authenticated query consumers are hard-gated on cache restore

The mobile app SHALL delay authenticated query consumers until persisted cache restoration completes so startup bootstrap does not flash loading or error states before cached data is available.

#### Scenario: Cached data exists on cold start

- **WHEN** the app cold-starts with a persisted query cache
- **THEN** the authenticated query-consuming tree SHALL wait for cache restoration before mounting
- **AND** cached data SHALL be available on first authenticated render

#### Scenario: Cache restore is still in progress

- **WHEN** persisted cache restoration has not finished yet
- **THEN** the authenticated query-consuming tree SHALL remain gated
- **AND** reconnect/invalidation logic SHALL wait until bootstrap readiness is established

---

### Requirement: All stale queries are invalidated on reconnect

When `appOnline` transitions from `false` to `true`, the app SHALL invalidate all queries in the `QueryClient` to trigger fresh data fetches from the server.

#### Scenario: Reconnect triggers invalidation

- **WHEN** the device and configured backend transition from not-reachable-for-app-work to reachable-for-app-work
- **THEN** `queryClient.invalidateQueries()` SHALL be called
- **AND** active queries SHALL refetch with fresh data from the server

---

### Requirement: Only successful queries are persisted

The persister SHALL filter the dehydrated cache to only include queries with a `success` status, excluding errored and pending queries.

#### Scenario: Errored query is not persisted

- **WHEN** a query has `status === 'error'`
- **THEN** it SHALL NOT be included in the persisted cache

#### Scenario: Successful query is persisted

- **WHEN** a query has `status === 'success'`
- **THEN** it SHALL be included in the persisted cache
