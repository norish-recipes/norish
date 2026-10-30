# 05: Realtime recovers from a half-open Redis

**What to build:** After a Redis restart that leaves a half-open socket, Norish notices the dead connection within seconds and reconnects. Readers' realtime subscriptions see Lagged, refetch what they missed, and keep receiving Realtime Events. Today the Realtime Hub can listen on a dead socket for minutes without a word.

The realtime E2E goes back to its original order (the Redis restart before the server restart) and becomes the regression test. See `.scratch/architecture-after-upgrades/spec.md`, Redis.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged.

**Status:** wontfix, duplicate of `.scratch/dependency-upgrades/issues/35-realtime-and-shutdown-recover-from-a-half-open-redis.md`

> 2026-10-14: the maintainer moved this into the dependency sweep. Its scope is in that plan's ticket 35, its connection-options criterion in ticket 34. "`protocol: 2` stays" below is reversed: RESP3, no protocol pin anywhere. Do the work there, not here.

- [ ] The publisher and the Realtime Hub's subscriber have a `socketTimeout` of about ten seconds.
- [ ] The hub sends `PING` every fifteen seconds while subscribed (RESP2).
- [ ] The hub no longer sends UNSUBSCRIBE before quitting.
- [ ] The hand-rolled retry strategy, keepalive and connect timeout are gone from the connection options, and ioredis 6's defaults apply.
- [ ] The publisher and the hub carry `connectionName`s.
- [ ] `protocol: 2` stays.
- [ ] A hub reconnect still reports Lagged to its subscriptions (ADR-0034), and a test proves it after a heartbeat timeout.
- [ ] The realtime E2E runs the Redis-restart scenario before the server-restart scenario again, and both pass, repeated with `--repeat-each` to rule out a flake.
- [ ] Shutdown after a Redis restart finishes without waiting on a QUIT the dead socket never answers.
- [ ] Release notes, under Fixes and Improvements: background jobs and realtime recover by themselves after a Redis restart. Share the line with the sweep's section-A fixes if they are in the same release.
