## ADDED Requirements

### Requirement: Connectivity reflects browser and HTTP backend reachability

The web client SHALL expose `checking`, `online`, `offline`, and `backend-unreachable` connectivity states. The state SHALL combine browser online/offline events with observed HTTP/tRPC transport outcomes and explicit recovery checks. Lazy WebSocket `idle`, `connecting`, or `disconnected` state SHALL NOT by itself determine backend reachability.

#### Scenario: Initial live requests are pending

- **WHEN** a fresh application load has not yet produced a successful or failed backend attempt
- **THEN** connectivity SHALL be `checking`

#### Scenario: The browser reports offline

- **WHEN** the browser reports that network connectivity is unavailable
- **THEN** connectivity SHALL be `offline`
- **AND** the client SHALL still allow the in-flight live attempt to fail normally before installing cached fallback data

#### Scenario: HTTP fails while the browser reports online

- **WHEN** an HTTP/tRPC request fails with a reachability error or backend-unavailable response while `navigator.onLine` is true
- **THEN** connectivity SHALL be `backend-unreachable`

#### Scenario: A recovery check succeeds

- **WHEN** an explicit or automatic lightweight backend recovery check succeeds
- **THEN** connectivity SHALL become `online`
- **AND** read revalidation and queued-write replay MAY resume
- **AND** WebSocket reconnection MAY already have started independently while the check was in progress

### Requirement: A compact connectivity control lives beside the version footer

For authenticated users, the existing user-menu footer SHALL contain a small connectivity control beside the current-version text on both desktop and mobile navigation. The control SHALL be present in every connectivity state, SHALL show a compact icon and text label, and SHALL open the offline-status modal. Connectivity SHALL NOT be moved onto the user avatar or replace the existing update-available avatar treatment.

#### Scenario: The user menu is opened while online

- **WHEN** the user opens the avatar menu and connectivity is online
- **THEN** the footer SHALL show a compact `Online` control beside the version

#### Scenario: The user menu is opened during an outage

- **WHEN** connectivity is offline or backend-unreachable
- **THEN** the same footer position SHALL show the corresponding compact status
- **AND** its accessible name SHALL describe that status

#### Scenario: The connectivity control is activated

- **WHEN** the user presses or clicks the footer control
- **THEN** the user menu SHALL close
- **AND** the responsive offline-status modal SHALL open

### Requirement: The offline-status modal explains connectivity and cached data

The modal SHALL use HeroUI v3 compound components and SHALL show the current connectivity state, last successful live contact, whether the visible screen is using cached data, and the active read-cache inventory. It SHALL distinguish stale cached data from current live data and SHALL surface IndexedDB or quota warnings.

#### Scenario: Cached fallback is active

- **WHEN** the modal opens while one or more screens are using IndexedDB fallback data
- **THEN** it SHALL identify the data as cached
- **AND** it SHALL show cache counts and last-updated timestamps by data type

#### Scenario: No offline data is available

- **WHEN** the active scope contains no compatible read snapshots
- **THEN** the modal SHALL say that no data is currently available offline
- **AND** it SHALL not claim that empty screens are cached successfully

#### Scenario: Persistence is degraded

- **WHEN** IndexedDB is blocked, unavailable, or out of quota
- **THEN** the modal SHALL show a persistence warning and identify which cache update failed when known

### Requirement: The modal provides safe recovery and cache actions

The modal SHALL provide a `Retry connection` action and a confirmed `Clear cached data` action. Retry SHALL perform a real HTTP recovery check before changing state. Clear SHALL remove only the active read-cache scope and SHALL leave the mutation outbox unchanged.

#### Scenario: Retry succeeds

- **WHEN** the user activates retry and the backend recovery check succeeds
- **THEN** connectivity SHALL become online
- **AND** replay/revalidation SHALL resume through their existing coordinators

#### Scenario: Retry fails

- **WHEN** the user activates retry and the backend remains unreachable
- **THEN** the current offline or backend-unreachable state SHALL remain
- **AND** any WebSocket transport started for that recovery attempt SHALL be suspended again
- **AND** the modal SHALL report the failed check without blocking other interaction

#### Scenario: Clear is requested

- **WHEN** the user activates clear cached data
- **THEN** the modal SHALL require confirmation before deleting the active read cache
- **AND** queued changes SHALL not be deleted or acknowledged

### Requirement: Queued-write diagnostics are integrated into the modal

The modal SHALL replace the fixed `WebOutboxStatus` panel as the web presentation for mutation delivery diagnostics. It SHALL count `pending + retrying` as active queued work, report quarantined, terminal, and expired entries separately as requiring attention, and retain access to completed results and acknowledgement actions without changing outbox storage or replay semantics.

#### Scenario: Writes are pending or retrying

- **WHEN** the active outbox scope contains pending or retrying mutations
- **THEN** the modal SHALL show their active count
- **AND** retrying entries SHALL be distinguishable from newly pending entries

#### Scenario: An entry requires attention

- **WHEN** an outbox entry is quarantined, terminal, or expired
- **THEN** the modal SHALL show it under an attention section
- **AND** it SHALL not include it in the automatically replayable count

#### Scenario: A completed result is inspected

- **WHEN** the user opens a retained delivery result in the modal
- **THEN** the result SHALL be readable and acknowledgeable through the existing outbox result API

#### Scenario: The provider tree renders

- **WHEN** the authenticated or public provider tree mounts
- **THEN** no fixed bottom-corner outbox diagnostic panel SHALL be rendered

### Requirement: Development builds can simulate backend unreachability

Development builds SHALL expose a persistent `Simulate backend unavailable` toggle inside the modal. The toggle SHALL use the same HTTP failure classification, connectivity state, read-cache fallback, replay pause, and recovery paths as a real outage. Production builds SHALL neither render nor honor the override.

#### Scenario: Simulation is enabled

- **WHEN** a developer enables the toggle
- **THEN** HTTP/tRPC operations SHALL fail through the normal backend-unreachable path
- **AND** connectivity SHALL become backend-unreachable
- **AND** active WebSocket subscriptions SHALL disconnect and SHALL NOT receive updates while the override remains active
- **AND** cached fallback and outbox capture SHALL behave as they do during a real transport failure

#### Scenario: A mutation occurs during simulation

- **WHEN** a mutation that the existing outbox supports is performed while simulation is enabled
- **THEN** it SHALL keep its normal optimistic UI behavior
- **AND** it SHALL be durably captured by the existing outbox with its operation identity

#### Scenario: Simulation is disabled

- **WHEN** a developer disables the toggle
- **THEN** the override SHALL be removed
- **AND** the client SHALL require a successful live recovery check before reporting online or resuming replay
- **AND** WebSocket subscriptions MAY reconnect while that HTTP recovery check is in progress
- **AND** they SHALL be suspended again if the check fails

#### Scenario: Production code reads simulation state

- **WHEN** the application runs in production
- **THEN** stored development simulation state SHALL be ignored

### Requirement: Status and diagnostics remain current across interaction and tabs

Connectivity, cache inventory, and outbox diagnostics SHALL update after relevant HTTP outcomes, cache commits or clears, outbox state changes, browser online/offline events, and changes made by another same-origin tab. Updates SHALL not require a full page reload or a blocking overlay.

#### Scenario: A cache commit completes

- **WHEN** a classified live read is committed to IndexedDB
- **THEN** an open modal SHALL update its counts and timestamps

#### Scenario: Another tab changes offline state

- **WHEN** another same-origin tab clears cached reads or changes outbox state
- **THEN** the current tab SHALL refresh the affected inventory or diagnostics through a cross-tab signal

#### Scenario: The app reconnects

- **WHEN** connectivity changes from offline or backend-unreachable to online
- **THEN** the footer control and an open modal SHALL update without remounting the application shell

### Requirement: Offline status is responsive and accessible

The connectivity control and modal SHALL be keyboard accessible, screen-reader labeled, and usable at desktop and mobile widths. Status meaning SHALL not rely on color alone, focus SHALL move into the modal when it opens and return to the invoking control when it closes, and the modal SHALL not cover global toast feedback.

#### Scenario: A keyboard user opens and closes the modal

- **WHEN** the footer control is activated from the keyboard
- **THEN** focus SHALL move into the modal
- **AND** closing it SHALL restore focus to the footer control

#### Scenario: A screen reader inspects connectivity

- **WHEN** assistive technology focuses the footer control
- **THEN** it SHALL receive the textual connectivity state and whether cached fallback is active

#### Scenario: The modal opens on a narrow viewport

- **WHEN** the modal is opened from mobile navigation
- **THEN** all status sections and actions SHALL remain reachable without horizontal scrolling

#### Scenario: A toast is emitted while the modal is open

- **WHEN** the application emits delivery or recovery feedback
- **THEN** the global toast region SHALL remain visible above the modal and its backdrop
