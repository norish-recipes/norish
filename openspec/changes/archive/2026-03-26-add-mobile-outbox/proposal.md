## Why

The mobile app already handles local-first state well, but write operations still fail outright when the backend is temporarily unreachable. Adding an outbox closes the remaining offline gap so user actions can be captured locally and replayed automatically once connectivity returns.

## What Changes

- Add a mobile outbox at the tRPC request layer that persists failed mutation requests into MMKV storage for later delivery.
- Add background retry and replay behavior that attempts queued requests when the backend becomes reachable again.
- Add removal, retry delay, and backoff rules so successful items are cleared quickly and failed items are retried safely.
- Define the client and server expectations for replaying exact queued requests without blocking on long-running backend work.

## Capabilities

### New Capabilities

- `mobile-outbox`: Persist failed mobile mutation requests and replay them automatically when the backend becomes reachable again.

### Modified Capabilities

## Impact

- Affects `apps/mobile` networking, offline handling, and MMKV-backed persistence.
- Likely touches shared tRPC client setup and mutation execution flow used by the mobile app.
- Introduces retry scheduling, replay orchestration, and observability requirements for queued requests.
- Relies on existing backend async handling so replayed requests can receive quick acknowledgements without waiting for downstream work.
