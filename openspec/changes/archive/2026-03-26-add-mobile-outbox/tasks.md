## 1. Outbox foundation

- [x] 1.1 Locate the mobile tRPC mutation execution path and define the outbox item shape needed to persist exact replayable requests in MMKV
- [x] 1.2 Implement the MMKV-backed outbox store with enqueue, load, update, and remove operations plus retry metadata fields
- [x] 1.3 Add error classification so only backend-unreachable mutation failures are captured into the outbox

## 2. Replay orchestration

- [x] 2.1 Build a single outbox replay coordinator that loads pending items, enforces stored order, and skips entries that are not yet eligible for retry
- [x] 2.2 Integrate backend reachability signals so replay starts when connectivity returns and avoids tight retry loops while unreachable
- [x] 2.3 Wire replay submission to remove items on OK responses and increment delay metadata on failed attempts

## 3. Verification

- [x] 3.1 Add tests for enqueue behavior, persistence across reloads, ordered replay, success removal, and incremental retry backoff
- [x] 3.2 Add logging or lightweight diagnostics for outbox processing so replay behavior can be debugged during rollout
- [x] 3.3 Validate the end-to-end mobile flow by simulating offline mutation failure, app restart, reconnect, and eventual queue drain
