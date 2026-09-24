# 10 — Manual release verification

**What to build:** nothing. Run the checks below against a production-style stack (the E2E harness in `apps/web/__tests__/e2e/harness/production-stack.ts`, or a compose stack with a reverse proxy in front) and record the outcomes, with dates and versions, under Comments. The automated E2E in `apps/web/__tests__/e2e/realtime/realtime.e2e.ts` (written with ticket 04 or 07, whichever first has both ends) must be green before starting. When every box is ticked and ticket 09 has shipped, delete `.scratch/realtime-foundation/`; the ADRs and the docs page are what outlives it.

**Blocked by:** 09.

**Spec:** `.scratch/realtime-foundation/spec.md` § Verification

**Status:** ready-for-human

- [x] Two browsers, one household: grocery create, update and delete propagate without a reload; a validation failure toasts only the browser that caused it
- [x] Browser B joins A's household while connected: B's socket closes with `4000`, reconnects, later events from A reach B; the server log shows B's old cursor refused with `identity-changed` and B's lists refetch
- [x] Server restart with both browsers connected: clients receive `1012`, reconnect within the backoff window, the events published during the restart arrive through Resume, Recovery runs once
- [ ] `SIGTERM` with fifty open sockets (a small script with `ws`): shutdown completes in under five seconds and the log shows the documented order
- [x] Redis restart: the server logs `realtime.reconnected`; every subscription ends Lagged; both browsers refetch and converge
- [ ] `redis-cli CLIENT LIST` shows the same connection count with one tab and with five; `redis-cli TTL norish:stream:grocery:household:<key>:created` is at most 86400 and a key untouched for a day is gone
- [ ] Behind the proxy: a mismatched `Origin` is refused with `403`; an absent `Origin` (`curl` with an upgrade request) is accepted; a proxy idle timeout of 30 s keeps the socket alive across five minutes of silence
- [x] An expired session: the browser lands on the sign-in page, not in a reconnect loop

## Comments

- 2026-09-21, `rc/0.24.0-beta` (0.24.0-beta, pre-tag). The automated suite the spec asked for now exists: `apps/web/__tests__/e2e/realtime/realtime.e2e.ts`, a third Playwright project (`realtime`, port 3300) on the production stack, two browsers in one household, nine scenarios, green (`pnpm --filter @norish/web run test:e2e --project=realtime`). What it settles of the list above, and what it leaves to a person:
  - **Ticked — fully automated.** Create/update/delete cross to the other browser without a reload and `failed` toasts only the browser that caused it (a real `NOT_FOUND` from a bogus Store id, through the router's catch). B joins mid-connection: `4000` on B's ledger, reconnect, twenty `identity-changed` refusals in the server log, `groceries.list` refetched. Redis restart (graceful, in place): `realtime.reconnected` once, every subscription ends `redis-reconnect`, a grocery created after it reaches the other browser. A revoked session (Better Auth's `revoke-sessions`; expiry follows the same Redis path) ends at `/login?callbackUrl=%2Fgroceries` after exactly one `4401`.
  - **Server restart** — 1012 to every socket (fifty raw `ws` sockets plus both browsers), shutdown under five seconds measured from SIGTERM to port closed (6–7 s scenario total including the boot), both browsers reconnect, later events reach B. Not automated: events published *during* the restart (one process, nothing publishes while it is down) and "Recovery runs once". The shutdown order is not asserted line by line (the project captures warn and above).
  - **Redis expectations** — `CLIENT LIST` is the same count with two browsers and with seven; `TTL norish:stream:grocery:household:<key>:created` is between 1 and 86400. A key untouched for a day being gone is a day's wait.
  - **Origin** — a foreign `Origin` is refused with `403`, an absent one with a session is accepted, an absent one without a session completes the handshake and is closed `4401`. Without a proxy in front; the proxy idle-timeout check over five minutes of silence stays manual.
  - **Network gap** (the spec's sixth case): B offline for five seconds with its socket dropped, A creates; on return B's resubscribe carries `lastEventId`, the missed grocery rides the new socket and is on screen while the `groceries.list` refetch is still held — Resume before Recovery.
  - Two defects the suite found on its first runs, both fixed with unit tests: the client hook stated `enabled: undefined`, which tRPC reads as *disabled*, so no web subscription had opened (ticket 07); and the hub deleted a channel's state on a stale refcount after an in-flight `UNSUBSCRIBE`, stranding a subscription that arrived during the round trip (ticket 03).
  - For the operator's attention, outside this ticket: sessions live only in Redis (Better Auth secondary storage), so a Redis restart that loses its dataset (a `SIGKILL`, or no persistence) signs everyone out and the web app shows nothing for it — every request 401s and the page goes quiet. The suite restarts Redis gracefully (SIGTERM, snapshot) for that reason; testcontainers takes the restart timeout in milliseconds, and its default is an immediate kill.
- 2026-09-21: the server-restart line is ticked on Mike's call. The suite asserts 1012 on every socket, the reconnect, and later events reaching the other browser; a publish during the restart (which needs a second process) and the single Recovery run are judged to work from the gap scenario rather than asserted.

