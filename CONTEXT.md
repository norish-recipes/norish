# Norish Domain Language

Use these terms when discussing behavior that remains available while Norish cannot
reach its backend.

## Offline surface

An authenticated screen whose last server-authorized view may remain available
during an outage. The web offline surfaces are the recipe dashboard, calendar, and
groceries. An installed fallback remains available when a later live refresh fails,
even if the query reports an error while retaining that data.

## Persisted read snapshot

The last successful server-authorized projection saved for one compatible viewer
scope. A snapshot may support stale, read-only rendering, but it is never evidence
of current authentication, authorization, or household membership.

## Render identity

The minimal last-confirmed user and household identity used to select a compatible
persisted read snapshot and render offline application chrome. A render identity
does not authorize server access or delivery of queued changes.

## Queued change

A user change accepted locally for later delivery. Queued changes are durable
intent, remain separate from persisted read snapshots, and require a live identity
before delivery.

## Recovery

The transition from a degraded experience back to live authority. Recovery
reconfirms reachability and identity, delivers queued changes, and then replaces
stale views with current server state.
