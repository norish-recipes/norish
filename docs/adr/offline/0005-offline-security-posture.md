# Offline security posture: device possession = read access

While Offline there is no server to validate a session against, so the Offline Cache is readable on the browser's authority alone: reads and queueing keep working across cookie expiry (Replay halts on UNAUTHORIZED until re-login), sign-out is disabled while Offline rather than faked locally, and we do not encrypt the cache against the session — cache-at-rest encryption buys little when the device is already unlocked, and belongs to the multi-day local-first scenario we explicitly rejected. The server's authority resumes at the sync boundary: nothing replays without a valid session.

## Consequences

- Cache and Outbox are keyed per user id and purged on account switch (with a warning if the outgoing user's Outbox is non-empty) — otherwise a second user on the same browser would boot into the first user's hydrated household view and replay their queued mutations under the wrong identity.
- Anyone with the unlocked device can read cached household data; acceptable for a self-hosted household app.
