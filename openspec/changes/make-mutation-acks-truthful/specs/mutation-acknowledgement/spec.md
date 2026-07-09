## ADDED Requirements

### Requirement: Write acknowledgements are truthful

A mutation SHALL NOT return a success response before its own immediate authoritative DB write has completed, unless the mutation is classified as an enqueue-style contract that only acknowledges acceptance of long-running work.

#### Scenario: Awaited mutation acknowledges a committed write

- **WHEN** a DB-backed mutation completes successfully
- **THEN** the response SHALL be produced only after the authoritative write committed
- **AND** the response SHALL carry `applied: true`

#### Scenario: Stale write is acknowledged as not applied

- **WHEN** a version check rejects the write as stale
- **THEN** the mutation SHALL return `applied: false` with `stale: true` instead of claiming the write happened

#### Scenario: Enqueue-style mutation acknowledges acceptance only

- **WHEN** a mutation intentionally starts long-running background work (imports, AI jobs, sync, archive import, server restart)
- **THEN** it SHALL await only the acceptance/enqueue of that work before responding
- **AND** it SHALL be classified `enqueue` in the audit matrix

### Requirement: Errors surface through the RPC error path

Converted mutations SHALL report failures by throwing errors, not by returning success and retracting it through a `failed` realtime event.

#### Scenario: Write failure is thrown

- **WHEN** the authoritative write of a converted mutation fails
- **THEN** the mutation SHALL throw a `TRPCError`
- **AND** it SHALL NOT emit a `failed` realtime event for that request

#### Scenario: Asynchronous workflows keep the failure event

- **WHEN** work classified `enqueue` fails after its acceptance was acknowledged
- **THEN** the system MAY report that failure through realtime events

### Requirement: Every mutation carries an acknowledgement classification

Every mutation in `appRouter` SHALL be classified as `awaited`, `fire-and-forget`, or `enqueue`, and the classification SHALL be enforced by a test that fails when a mutation is unclassified or when the fire-and-forget set grows.

#### Scenario: New mutation ships unclassified

- **WHEN** a new mutation is added to `appRouter` without an audit classification
- **THEN** the classification test SHALL fail

#### Scenario: Fire-and-forget set only shrinks

- **WHEN** a mutation is converted to await its write
- **THEN** it SHALL move out of the fire-and-forget list
- **AND** adding a new fire-and-forget mutation SHALL fail the test
