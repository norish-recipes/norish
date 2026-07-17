---
sidebar_position: 2
title: Web offline reads and status
description: How Norish restores scoped recipe, calendar, and grocery reads when the web backend cannot be reached.
---

# Web offline reads and status

Norish keeps a bounded set of successful web reads in IndexedDB so a previously
opened screen can remain useful when the browser is offline or the backend is
unreachable. This cache complements the encrypted mutation outbox; it does not
replace authentication, authorization, or server data.

## Live-first startup

Every fresh application load starts the normal Better Auth session and screen
queries immediately. Existing page skeletons remain visible while that first
live attempt is pending. IndexedDB scope metadata may be prepared in parallel,
but cached payloads are not installed early.

Fallback begins after a qualifying offline or transport failure, or after the
2.5-second reachability deadline. The cache restores data into the exact
TanStack Query keys already consumed by the recipe dashboard, recipe detail,
calendar, grocery, and store screens. A late successful live response remains
authoritative and replaces the cached view. Authentication, authorization, and
validation responses are server answers, so they do not trigger offline
fallback.

If the active screen has no compatible record, the skeleton resolves to an
explicit unavailable-offline state instead of implying that an empty result is
current data. Automatic read retries pause while connectivity is degraded. On
recovery, queued mutations replay before authoritative reads refetch.

## Stored reads and retention

The `norish-web-read-cache` database stores only complete successful results
from this allowlist:

- the first 100 recipes from the default dashboard query;
- the 50 most recently used complete recipe details;
- the latest successful date range requested by the calendar screen;
- `groceries.list`, including recurring groceries and recipe-name mappings;
- `stores.list`.

Norish does not crawl routes or issue background requests to increase offline
coverage. Errors, aborted requests, retries, partial writes, and non-allowlisted
queries do not replace the last successful record. Cache inventory counts and
timestamps therefore describe what is actually available offline.

## Scope and security boundary

Every record belongs to the tuple of backend origin, last-confirmed user,
last-confirmed household, and read-cache schema version. The scope also keeps
the minimum user and household values needed to render application chrome and
select records during an outage.

That identity is explicitly render-only. It cannot authorize an API call,
mutation replay, permission decision, or household switch. Better Auth and the
server remain authoritative. A contradictory live user waits for its household
scope before switching caches, and a server-confirmed anonymous session removes
the active render scope so private data cannot appear on a later anonymous
launch.

## Service-worker boundary

The service worker keeps three narrow cache classes:

- safe static manifest, icon, and deterministic offline-fallback assets;
- exact application-route HTML shells confirmed after a successful online
  load;
- same-origin versioned `/_next/static/` scripts and styles required to hydrate
  those shells.

Document navigation is network-first. A cold offline launch can use only an
exact route that was previously confirmed with all required runtime assets. An
unconfirmed route receives the deterministic offline page and must be opened
online once before it is available offline.

Personalized API responses and generic recipe or user images are never stored
in Cache Storage. Personalized fallback data belongs only in the scoped
IndexedDB read cache.

## Offline-status controls

The user-menu footer contains an always-present connectivity control beside the
version. It opens the responsive offline-status modal, which shows:

- browser/backend connectivity and the last successful live contact;
- whether the visible screen uses cached data;
- per-type cached counts and timestamps, schema information, and persistence
  warnings;
- queued-mutation diagnostics and retained outcomes;
- a real connection retry and a confirmed clear action for the active read
  scope;
- a development-only backend-unreachable simulator.

Clearing cached reads affects only the active read-cache scope. It does not
delete or modify the mutation outbox.

## Mutation delivery limitation

Read fallback does not add closed-PWA mutation replay. Offline mutations can be
captured durably by the existing encrypted outbox, but the browser application
must be running to replay them. The service worker does not deliver mutations
in the background.

## Browser test commands

Install the Playwright-managed Chromium binary once:

```bash
pnpm --filter @norish/web run e2e:install
```

Run the complete isolated suite or only the critical CI scenarios:

```bash
pnpm --filter @norish/web run e2e
pnpm --filter @norish/web run e2e:critical
pnpm --filter @norish/web run e2e:simulator
```

The harness builds the production web application and provisions disposable
password-protected PostgreSQL and Redis containers unless external E2E service
URLs are supplied. The simulator command intentionally starts the development
runtime because that control is absent from production. Failure traces,
screenshots, and videos are written below `apps/web/test-results/e2e`.
