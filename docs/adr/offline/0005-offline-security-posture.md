# Offline security posture: device possession = read access

While Offline there is no server to validate a session against, so the Offline Cache is readable on the browser's authority alone: reads and queueing keep working across cookie expiry until Session Expiry (a 401 response or 4401 socket close clears the Offline Cache and keeps the Outbox for that Account), and we do not encrypt the cache against the session — cache-at-rest encryption buys little when the device is already unlocked, and belongs to the multi-day local-first scenario we explicitly rejected. Sign-out ends the session first and only then forgets the Offline Cache; only the server can end a browser's session, so a browser cannot sign out while Offline rather than faking it locally, while a phone holds its own session and always can. A sign-out with work still in the Outbox discards that work only after the reader confirms. The server's authority resumes at the sync boundary: nothing replays without a valid session, and Replay checks that the live session belongs to the queue's owner.

## Consequences

- Cache and Outbox are keyed per user id. On an account switch the outgoing user's reads and personalized images are purged before anything renders for the incoming one, so a second user on the same browser never boots into the first user's household view. The outgoing user's Outbox stays dormant under its owner and replays only when that owner signs in again, never under another identity.
- Anyone with the unlocked device can read cached household data; acceptable for a self-hosted household app.
