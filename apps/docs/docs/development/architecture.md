---
sidebar_position: 2
title: Architecture
description: How the repository is laid out, where code goes, and how data moves between a screen and Postgres.
---

# Architecture

Norish is one Node server and two clients, a Next.js web app and an Expo mobile
app. The clients talk to the server through tRPC. Queries and mutations go over
HTTP, and realtime events over one WebSocket.

## Folder structure

```
norish/
├── apps/
│   ├── web/               # Next.js app, and the server entry in server/
│   ├── mobile/            # Expo app
│   ├── parser-api/        # Python service around recipe-scrapers
│   ├── docs/              # This site
│   ├── landing/           # norish.dev
│   └── quick-import-extension/  # Browser extension, a git submodule kept in its own repository
├── packages/
│   ├── api/               # The server process, the import parser, CalDAV sync and video processing
│   ├── auth/              # Better Auth, sessions and permission checks
│   ├── config/            # Environment config and default reference data
│   ├── db/                # Repositories, migrations and the Drizzle client
│   ├── db-schema/         # Drizzle table definitions
│   ├── i18n/              # Locales and messages
│   ├── queue/             # Background jobs on BullMQ
│   ├── shared/            # Contracts and helpers that clients and server both import
│   ├── shared-react/      # React logic both apps share
│   ├── shared-server/     # Server logic several packages use: AI, realtime, ingredients, Valkey
│   ├── trpc/              # tRPC routers and the tRPC server
│   └── ui/                # Shared React components
├── tooling/
│   ├── eslint/            # Lint config, including the feature import rules
│   ├── prettier/          # Prettier config
│   ├── typescript/        # tsconfig files
│   ├── tailwind/          # Tailwind theme
│   ├── github/            # Composite GitHub Actions
│   ├── monorepo/          # Circular dependency and workspace import checks
│   ├── ingredient-icons/  # Draws the Ingredient Icons Norish ships
│   └── nutrition/         # Builds the nutrition source table
└── docker/                # Compose files and images
```

## What goes where

### In an app

Web and mobile use the same layout. Web keeps its folders at the root of
`apps/web`, mobile in `apps/mobile/src`.

- `app/` holds the route files, which render screens from features. On web a
  route file also does the server-only work: seeding the cache, metadata and
  params.
- `features/<feature>/` holds one domain's screens, components, hooks and
  helpers. Each feature is a domain: `library`, `recipes`, `cookbooks`,
  `groceries`, `calendar`, `imports`, `settings`, `auth` and `share`.
- A feature groups its `components/` by area, and each area has an `index.ts`
  that screens and other areas import. Groceries has `header/`, `list/`,
  `panels/`, `pantry/` and `stores/`.
- A feature's `index.ts` exports only the panels other features open, such as
  `MiniGroceries`. Shared code may import that `index.ts` and nothing deeper.
  Only route files import a feature's other files. Lint enforces this.
- A feature's tests sit in one flat `features/<feature>/__tests__/` folder.
- One root draws the views that share a layout.
  `app/(app)/groceries/layout.tsx` renders `GroceriesRoot`, which holds the
  header and the subscriptions and draws the list or the Pantry from the
  address, so switching views stays on the client. The layout seeds the reads
  of the view a full load opens on. `page.tsx` and `pantry/page.tsx` render
  nothing and only give each view an address.
- Code two or more features use goes in the app's shared folders: `components/`,
  `hooks/` and `lib/` on web, `hooks/` and `lib/` on mobile.

Imports run one way: shared folders, then features, then routes.

On web and in shared-react only groceries has moved so far. Library and recipes,
calendar, cookbooks, settings, imports, auth and share still live in web's
`components/`, `hooks/`, `context/` and `stores/`, and in shared-react's `hooks/`
and `contexts/`.

### In shared-react

A domain folder in `packages/shared-react/src/`, such as `groceries/`, holds one
domain's hooks, client stores, realtime subscriptions and types. Apps import it
as `@norish/shared-react/<domain>`, and its tests sit in
`src/<domain>/__tests__/`. One domain can serve several app features.

The cross-cutting folders serve every domain:

- `trpc/` creates the one tRPC context, so every hook imports `useTRPC` from
  here. It also builds the links and each app's provider.
- `platform/` is the adapter each app mounts once, for toasts, navigation, error
  display, storage and Device Kind.
- `offline/` is the offline engine: the Offline Cache, the Outbox, Replay,
  Recovery, and the optimistic-update helpers every domain's mutations use.
- `config/` reads reference data such as units, tags and recurrence words.
- `reader/` holds the signed-in Reader. Today that is their Device Preferences
  and Device Kind.
- `realtime/` holds `useRealtimeSubscription`, which every subscription is built
  on, and `useKeepsCurrent`.

A domain never imports another domain, and a cross-cutting folder never imports
a domain. Lint enforces both.

### Contracts

Clients and server both import `@norish/shared`. Its `src/contracts/` holds the
DTO types, the zod schemas, the Realtime Catalogues (`contracts/realtime/`) and
the recipe list's query inputs (`filter-contract.ts`, `list-queries.ts`). Its `src/lib/` holds helpers both sides run, such as the
recurrence calculator. A type or schema both sides need goes here.

### On the server

- `packages/trpc/src/routers/<domain>/` holds the procedures. A procedure
  validates its input with zod, checks that the Reader may touch the data, does
  the work, and publishes Realtime Events after the write. Longer logic goes in a
  helper file beside the router, such as `groceries-helpers.ts`, or in
  `packages/shared-server`.
- `packages/db/src/repositories/` holds every database query. Routers read and
  write through repositories, never with queries of their own.
- `packages/shared-server` holds server logic several packages use: AI,
  realtime, ingredients, the server config loader and the Valkey clients.
- `packages/api` is the server process and the work that runs beside requests:
  the HTTP and WebSocket server and the boot tasks (`startup/`), the import
  parser (`parser/`), CalDAV sync (`caldav/`) and video processing (`video/`).
- `packages/queue` runs background jobs. Jobs reach the parser through handlers
  `packages/api` registers at boot.

### The AI boundary

Everything under `packages/shared-server/src/ai/` is AI:

- `runtime/` is the one place that talks to a model
  ([ADR-0015](https://github.com/norish-recipes/Norish/blob/main/docs/adr/ai/0015-norish-issues-every-model-request-through-one-runtime.md)).
- `prompts/` holds the prompts an administrator can edit, and their loader.
- `enrichment/` holds the features that read a stored recipe and claim something
  about it, such as its allergens or its nutrition.
- `resolution/` holds the features that decide which catalogue entry a name is.

Recipe extraction uses AI but belongs to the import pipeline, so it lives with
the parser in `packages/api/src/parser/`. A feature calls
`ai/runtime/runtime.ts` with the name of a prompt and the sections to append to
it. It never builds a provider client or passes a finished prompt
([ADR-0016](https://github.com/norish-recipes/Norish/blob/main/docs/adr/ai/0016-prompts-are-appended-to-never-interpolated.md)).

## Decisions

Each decision links its ADR where one exists.
[CONTRIBUTING.md](https://github.com/norish-recipes/Norish/blob/main/CONTRIBUTING.md#app-architecture)
gives the reasons for the rest.

- Components read server data through hooks over the TanStack Query cache, the
  one copy on a client, which offline mode persists
  ([ADR-0001](https://github.com/norish-recipes/Norish/blob/main/docs/adr/offline/0001-web-offline-is-a-persisted-query-cache.md)).
  Nothing copies it into a context or a store.
- A realtime handler merges an event into the cache by id, so a repeated event
  changes nothing and no client needs to skip its own
  ([ADR-0032](https://github.com/norish-recipes/Norish/blob/main/docs/adr/realtime/0032-realtime-is-one-hub-one-catalogue-one-idiom.md)).
- A subscription that falls behind ends Lagged, and the client reads that domain
  again
  ([ADR-0032](https://github.com/norish-recipes/Norish/blob/main/docs/adr/realtime/0032-realtime-is-one-hub-one-catalogue-one-idiom.md)).
  A reconnect first resumes the missed events from a bounded buffer
  ([ADR-0034](https://github.com/norish-recipes/Norish/blob/main/docs/adr/realtime/0034-resume-is-a-bounded-buffer-not-a-guarantee.md)).
- Every mutation carries an operation id, so one the Outbox replays runs once
  ([ADR-0002](https://github.com/norish-recipes/Norish/blob/main/docs/adr/offline/0002-replay-idempotency-via-operation-id-middleware.md)).
- A create takes a Client-Minted Id, so changes queued behind it point at the
  right row
  ([ADR-0003](https://github.com/norish-recipes/Norish/blob/main/docs/adr/offline/0003-client-minted-entity-ids-on-create.md)).
- zustand holds client state several components share, and state one component
  owns stays in `useState`. A store holds ids, never a copy of server data.
- No feature imports from inside another. A feature opens another's panels
  through that feature's `index.ts`.
- A write's rollback and settle go in `useMutation`'s own options. A `mutate`
  call's callbacks run only for the last call, so an overlapped failure would
  keep its change.
- A realtime subscription names the reads it keeps current with
  `useKeepsCurrent`, so web doesn't read them again on mount until they go
  stale.
- Web, mobile, shared-react and `packages/ui` compile with the React Compiler,
  and lint reports every component or hook it skips.

## How data flows

The examples follow a grocery on the list. Other domains work the same way.

### A read

A component asks a hook for what it draws. `useGroceryFor(id)` in
`@norish/shared-react/groceries` calls `useQuery` with
`trpc.groceries.list.queryOptions()` and a `select` that picks one row, so the
component re-renders only when that row changes.

When the Query cache holds a fresh list, nothing leaves the client. Otherwise
the tRPC links batch the read into an HTTP request to `/api/trpc`, which
`app/api/trpc/[trpc]/route.ts` hands to the router in `packages/trpc`. The
`groceries.list` procedure reads through the grocery repositories in
`packages/db`, and the answer lands in the cache.

```mermaid
sequenceDiagram
  participant C as Component
  participant Q as Query cache
  participant L as tRPC links
  participant R as Router
  participant D as Repository
  participant P as Postgres
  C->>Q: useGroceryFor(id)
  alt missing or stale
    Q->>L: groceries.list
    L->>R: HTTP batch to /api/trpc
    R->>D: listGroceriesByUsers
    D->>P: SELECT
    P-->>D: rows
    D-->>R: grocery DTOs
    R-->>Q: the list
  end
  Q-->>C: the selected row
```

On a full page load the route runs the same reads on the server through
`QuerySeed`, which calls the router without HTTP, and sends the answers with the
document. While Offline the Offline Cache answers with what it stored.

### A write

A component calls an action from `useGroceriesMutations()`, such as
`toggleGroceries(ids, isDone)`. The action runs a `useMutation` whose options
hold the whole write:

1. `onMutate` keeps the list as it is and writes the change into the cache, so
   the rows change before the server answers.
2. The tRPC links stamp an operation id on the mutation and send it over HTTP to
   `/api/trpc`.
3. On the server the idempotency middleware claims the operation id. The
   `groceries.toggle` procedure checks household access, writes through
   `updateGroceries` in `packages/db`, and publishes an `updated` event.
4. If the write fails, `onError` puts the kept list back and shows an error.

While Offline the mutation can't reach the server. The Outbox link stores it in
the Outbox and passes the error on, which `onError` reads as Queued, so the
change stays. Once the server is reachable, Recovery replays the Outbox with the
same operation ids.

```mermaid
sequenceDiagram
  participant M as useMutation
  participant Q as Query cache
  participant L as tRPC links
  participant O as Outbox
  participant R as Router
  participant P as Postgres
  M->>Q: onMutate writes the change
  M->>L: groceries.toggle with an operation id
  alt Live
    L->>R: HTTP to /api/trpc
    R->>P: updateGroceries in the repository
    R-->>M: success
  else Offline
    L->>O: store the mutation
    L-->>M: Queued, onError keeps the change
    O->>R: Recovery replays it once Live
  end
```

### A realtime update

After the write, the procedure calls `groceries.publish("updated", payload)`.
`groceries` is the server side of the groceries Realtime Catalogue, in
`packages/shared-server/src/realtime/groceries.ts`. `publish` checks the payload
against the catalogue, stamps the operation id, and runs one Valkey script that
adds the event to the channel's Resume Buffer and publishes it.

Each server process has one Realtime Hub (`realtime/hub.ts`), its only Valkey
subscriber. The hub hands the event to every subscription on the household's
channel. Each subscription procedure is one
`realtimeSubscription(groceries, "updated")` line, from
`packages/trpc/src/realtime-subscription.ts`, and sends the event as an Envelope
over the WebSocket.

On the client, `GroceriesRoot` mounts `useGroceriesSubscription`, which builds
each subscription on `useRealtimeSubscription`. Its `updated` handler merges the
changed rows into the cached list by id with `setQueryData`, and the components
whose slice changed re-render. The client that made the change gets the event
too, and merging it again changes nothing.

```mermaid
sequenceDiagram
  participant R as Router
  participant V as Valkey
  participant H as Realtime Hub
  participant U as useGroceriesSubscription
  participant Q as Query cache
  participant C as Component
  R->>V: publish updated, after the commit
  V->>H: the event on the household channel
  H->>U: an Envelope over the WebSocket
  U->>Q: merge the changed rows by id
  Q-->>C: re-render if its slice changed
```

A subscription that falls behind ends Lagged. The client starts a fresh one and
reads the list again once it is live.
