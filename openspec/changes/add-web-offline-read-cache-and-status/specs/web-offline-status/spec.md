## ADDED Requirements

### Requirement: Web connectivity status is distinct from lazy WebSocket state

The web client SHALL expose an application connectivity state with `initializing`, `offline`, `backend-unreachable`, and `online` modes. It SHALL combine browser reachability signals with observed HTTP delivery failures and successful recovery, and SHALL NOT treat a lazy WebSocket `idle` state as proof that the backend is unavailable.

#### Scenario: The browser reports no network

- **WHEN** the browser reports that it is offline
- **THEN** the application connectivity state SHALL become `offline`
- **AND** the user-facing status surface SHALL expose the offline state

#### Scenario: HTTP delivery fails while the browser reports online

- **WHEN** an authenticated HTTP request fails because the backend cannot be reached while browser connectivity remains available
- **THEN** the application connectivity state SHALL become `backend-unreachable` or an equivalent degraded state
- **AND** the UI SHALL not claim that the backend is healthy solely because `navigator.onLine` is true

#### Scenario: Connectivity recovers

- **WHEN** a backend request succeeds after an offline or backend-unreachable state
- **THEN** the application connectivity state SHALL return to `online`
- **AND** queued mutation diagnostics and read-cache revalidation MAY begin through the existing reconnect behavior

### Requirement: Connectivity status takes priority over update status

The avatar status surface SHALL use one explicit priority order: initializing has no indicator; offline or backend-unreachable uses a yellow connectivity dot; online queue attention uses a warning status; active queued writes use a queue count badge; update availability uses the existing accent dot only when no higher-priority state is present; and a clean online state has no indicator.

#### Scenario: Offline and update are both present

- **WHEN** the application is offline or backend-unreachable and a new version is available
- **THEN** the avatar SHALL show the yellow connectivity indicator instead of the update-available dot
- **AND** the update information MAY remain available inside the user menu

#### Scenario: Online with queued writes

- **WHEN** the application is online and one or more mutations are pending or retrying
- **THEN** the avatar SHALL expose the active queue count
- **AND** the update dot SHALL not obscure or replace the queue status

### Requirement: The avatar indicator uses the HeroUI v3 status composition

The web user menu SHALL render the existing user avatar through HeroUI v3 composition, using `Badge.Anchor` for the connectivity dot and active queue count. The indicator SHALL expose an accessible text label describing the current connectivity and queue state.

#### Scenario: The user menu renders while offline

- **WHEN** the authenticated navbar renders in an offline or backend-unreachable state
- **THEN** the existing avatar SHALL be wrapped in a HeroUI v3 badge anchor with a yellow status dot
- **AND** the trigger SHALL expose an accessible label such as `Offline`

#### Scenario: The user menu renders with queued writes

- **WHEN** active queued writes exist
- **THEN** the avatar SHALL expose a numeric HeroUI v3 badge for the active count
- **AND** the accessible label SHALL include the count

### Requirement: The offline queue is discoverable from the user menu

The user menu SHALL provide an explicit queue entry that opens a HeroUI v3 queue view on desktop and mobile. The queue view SHALL replace the raw fixed diagnostic panel as the primary presentation surface.

#### Scenario: The user opens the queue view

- **WHEN** the user selects the offline queue entry from the avatar menu
- **THEN** a keyboard- and screen-reader-accessible HeroUI v3 overlay SHALL open
- **AND** it SHALL show active queued work, retrying work, and items requiring attention

#### Scenario: No active queue exists

- **WHEN** there are no pending or retrying entries and no attention items
- **THEN** the avatar SHALL not show a queue count
- **AND** the queue view SHALL remain available from the menu only when there are retained delivery results or diagnostics to inspect, or be omitted when completely clean

### Requirement: Queue counts distinguish waiting work from attention items

The queue view SHALL count `pending + retrying` as active queued writes. Quarantined, terminal, and expired entries SHALL be reported separately as items requiring attention and SHALL NOT be counted as automatically deliverable work.

#### Scenario: Pending and retrying entries exist

- **WHEN** the outbox contains two pending entries and one retrying entry
- **THEN** the avatar and queue view SHALL report three active queued writes
- **AND** the queue view SHALL identify the retrying entry separately

#### Scenario: A replay requires attention

- **WHEN** the outbox contains a quarantined, terminal, or expired entry
- **THEN** the queue view SHALL report it under an attention state
- **AND** it SHALL not inflate the automatically deliverable count

### Requirement: Queue state updates remain visible while the application is interactive

The status and queue view SHALL update after enqueue, replay, retry, quarantine, terminal, expiration, and acknowledgement events without blocking the application or showing a full-screen reconnect overlay.

#### Scenario: A mutation becomes queued

- **WHEN** a mutation is durably captured by the existing web outbox
- **THEN** the avatar count and queue view SHALL update without requiring a full page reload

#### Scenario: Replay completes or needs attention

- **WHEN** a queued entry is delivered, retried, quarantined, becomes terminal, expires, or is acknowledged
- **THEN** the status surface SHALL reflect the new count and state
- **AND** the application SHALL remain interactive

### Requirement: Status meaning is not conveyed by color alone

The web status surface SHALL expose text or accessible labels for offline, backend-unreachable, queued, retrying, and attention states. The yellow dot and numeric badge SHALL supplement, not replace, the textual queue view.

#### Scenario: A screen reader inspects the avatar

- **WHEN** a screen reader focuses the user-menu trigger
- **THEN** it SHALL receive a label describing the highest-priority connectivity state and active queue count

#### Scenario: The queue view is opened by keyboard

- **WHEN** a keyboard user opens the queue view
- **THEN** focus SHALL move into the HeroUI v3 overlay and the queue states SHALL be navigable without pointer interaction

### Requirement: Development builds can simulate backend unreachability

Development builds SHALL expose a persistent, clearly labeled control for simulating backend unreachability. The simulator SHALL force the same connectivity status and request-failure classification used by a real backend outage, while production builds SHALL not expose or honor the control.

#### Scenario: The developer enables simulated backend unreachability

- **WHEN** the development-only simulator is enabled
- **THEN** the avatar SHALL show the backend-unreachable connectivity indicator
- **AND** HTTP/tRPC requests SHALL fail through the normal reachability error path
- **AND** queued replay and online hydration SHALL pause

#### Scenario: A destructive mutation runs during simulated backend unreachability

- **WHEN** the developer deletes a recipe, grocery, or calendar item while the simulator is enabled
- **THEN** the mutation SHALL traverse the existing outbox capture path
- **AND** it SHALL be durably queued with the same operation identity and optimistic behavior as a real transport failure

#### Scenario: The developer disables simulated backend unreachability

- **WHEN** the simulator is disabled
- **THEN** the connectivity override SHALL be removed
- **AND** the client SHALL perform a live recovery check before resuming replay or read-cache hydration

### Requirement: Toast feedback remains above menus and dialogs

The web overlay stack SHALL keep ordinary desktop menus below modal dialogs and SHALL render the global toast region above both layers.

#### Scenario: A toast is emitted while the user menu is open

- **WHEN** a toast notification is emitted while the desktop avatar menu is open
- **THEN** the toast SHALL remain visually above the menu

#### Scenario: A toast is emitted while a modal is open

- **WHEN** a toast notification is emitted while a modal dialog is open
- **THEN** the toast SHALL remain visually above the modal and its backdrop
