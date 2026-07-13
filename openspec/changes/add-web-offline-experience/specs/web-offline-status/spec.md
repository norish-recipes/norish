## ADDED Requirements

### Requirement: Web reachability exposes settled offline modes

The web client SHALL expose an internal bootstrap state and settled `offline`, `backend-unreachable`, and `online` modes based on browser connectivity plus recent backend delivery signals.

#### Scenario: Browser is offline

- **WHEN** browser connectivity reports no network
- **THEN** the settled mode SHALL be `offline`

#### Scenario: Browser is online but Norish is unreachable

- **WHEN** browser connectivity is available
- **AND** authenticated HTTP delivery fails due to backend reachability
- **THEN** the settled mode SHALL be `backend-unreachable`

#### Scenario: Backend recovers

- **WHEN** a backend request or recovery probe succeeds after an unreachable state
- **THEN** the settled mode SHALL become `online`
- **AND** queued replay and authoritative refetch coordination SHALL be triggered

### Requirement: Connectivity status takes priority over update status

The user-avatar status slot SHALL show the yellow connectivity indicator whenever the settled mode is `offline` or `backend-unreachable`, regardless of whether an application update is available.

#### Scenario: Offline with an update available

- **WHEN** the app is offline or backend-unreachable
- **AND** an update is available
- **THEN** the yellow connectivity indicator SHALL be shown
- **AND** the update-available accent indicator SHALL not replace it

#### Scenario: Online with an update available

- **WHEN** the settled mode is `online`
- **AND** an update is available
- **THEN** the existing update-available indicator MAY be shown

### Requirement: Queue count is visible independently from connectivity

The web client SHALL expose the number of pending and retrying mutations as a numeric queue indicator without redefining the connectivity dot.

#### Scenario: Pending mutations exist while online

- **WHEN** the settled mode is `online`
- **AND** one or more mutations are pending or retrying
- **THEN** the avatar or adjacent status control SHALL show the queued count

#### Scenario: Pending mutations exist while offline

- **WHEN** the settled mode is `offline` or `backend-unreachable`
- **AND** one or more mutations are pending or retrying
- **THEN** the yellow connectivity indicator SHALL remain primary
- **AND** the queued count SHALL remain discoverable

### Requirement: Queue details are actionable and non-blocking

The status control SHALL open an accessible view of queued, retrying, quarantined, terminal, expired, and completed-delivery operations without blocking the underlying application.

#### Scenario: User opens queue details

- **WHEN** the user activates the avatar status control
- **THEN** the queue view SHALL show operation path, state, retry/attention information, and relevant timestamps

#### Scenario: User discards a terminal operation

- **WHEN** the user explicitly discards a terminal or expired operation
- **THEN** the operation SHALL be marked discarded and removed from the active queue count

#### Scenario: User retries an eligible operation

- **WHEN** the user requests retry for a quarantined or retryable operation and a valid session is available
- **THEN** the coordinator SHALL attempt replay without requiring the original screen to remain mounted

### Requirement: Status changes propagate across contexts

The web client SHALL propagate outbox and reachability changes between open tabs, the active window, and the service worker when those contexts exist.

#### Scenario: Service worker completes a queued mutation

- **WHEN** the service worker changes an outbox entry while no page is open
- **THEN** the next page load SHALL show the updated state

#### Scenario: Another tab changes queue state

- **WHEN** a different open tab queues, completes, discards, or quarantines an operation
- **THEN** the current tab SHALL refresh its displayed counts and details without a full page reload

