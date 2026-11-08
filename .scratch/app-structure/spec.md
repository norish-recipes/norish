# App structure: features over one shared-react

Status: ready-for-agent

Settled in a `/grilling` session on 2026-11-07. Target Version: 0.27.0-beta. Tickets are in `issues/`; only the groundwork and the groceries pilot are ticketed, and each later feature gets its tickets once the one before it has landed. Starts on a branch off `rc/0.27.0-beta` after `feat/mobile-catch-up` has merged into it.

## Problem Statement

Web and mobile are about to be built side by side again, and they are organised differently. Mobile's catch-up laid it out by feature; web is laid out by type at the top (`components/`, `hooks/`, `context/`, `stores/`) with domains inside, so one feature is spread across up to five folders. Groceries alone lives in `app/(app)/groceries`, `components/groceries`, `hooks/groceries` and shared-react's `contexts/groceries` and `hooks/groceries`.

The "heavy" contexts are mostly server data in disguise. `RecipesContext` (23 fields, mounted app-wide), `RecipeDetailContext` (~40), `AdminSettingsContext` (~50), `GroceriesContext`, `StoresContext` and `CalendarContext` each bundle TanStack Query data, mutation callbacks and a realtime subscription into one value, so a component that only needs `createRecipe` re-renders whenever the recipe list changes. Two layers (`WebUserContext`, the `RecipesContextAdapter`) only re-provide a value.

shared-react reaches both apps through about 16 `create*Hooks({ useTRPC, … })` factories plus context factories, and each app binds every one in its own files. Infer-mode React Compiler can't see factory-built hooks without a `"use memo"` directive, and aliasing them caused the hook-alias trap on mobile. What the factories inject is almost never another feature: it is `useTRPC`, reference data (units, recurrence config), the signed-in **Reader** (id, name, allergies, household) and platform adapters (toast, navigation, error, storage).

## Solution

Both apps are laid out the same way, and logic a feature shares lives once in shared-react under the same domain name.

- An app's `features/<feature>/` holds that feature's screens, components and platform hooks. Route files compose features; a feature never imports another.
- Server data is read through plain hooks over the Query cache, never copied into a context or a store. Realtime subscriptions mount once in a feature's root.
- Client state that several components share lives in a zustand store; state one component owns stays in `useState`.
- shared-react is organised by feature, creates the tRPC context once, and takes platform differences through one adapter. Its features don't import each other either; they import cross-cutting folders.

Groceries is the pilot, measured before and after. The rest follows in order, and the old type folders are deleted when the last feature has migrated.

## User Stories

1. As a contributor, I want one feature's code in one folder per app plus one in shared-react, so that I can find all of groceries without searching five folders.
2. As a contributor, I want web and mobile to use the same feature names and rules, so that moving between the apps feels the same.
3. As a contributor building a mobile screen, I want the feature's data, mutations, realtime and client state already in shared-react, so that I only write the UI.
4. As a contributor, I want to import a shared hook directly, so that I don't have to bind a factory in each app first.
5. As a contributor, I want lint to stop one feature importing another, so that features stay separable without review catching it.
6. As a contributor, I want the architecture written down in CONTRIBUTING.md with a line of why per rule, so that I can follow it without reading this spec.
7. As a new contributor, I want a docs page that shows how the repo is laid out and how data flows from a component to Postgres and back, so that I can find my way before reading code.
8. As a household member, I want the groceries page to do no more rendering than what changed on screen, so that checking off items stays quick on a phone.
9. As a household member, I want groceries to behave exactly as before, so that the restructure is invisible to me.
10. As a maintainer, I want the pilot measured with a committed script, so that every later feature is measured the same way.

## Implementation Decisions

### Features

- Features are named by domain: `library` (dashboard grid, filters, selection), `recipes` (detail, new, edit), `cookbooks`, `groceries` (stores and pantry included), `calendar`, `imports`, `settings`, `auth` and `share`. Most map to one route; a route that shows several, like the dashboard with today's meals, composes them.
- An app feature holds only the subfolders it needs. Code two or more features use lives in the app's shared `components/`, `hooks/` or `lib/`.
- Imports run one way: shared folders, then features, then routes. A `no-restricted-imports` override in each app's ESLint config enforces it, as mobile's already does.

### Web layout

- Web does not move into `src/`. `features/` sits next to `app/`; `server/` and `config/` stay where they are.
- Route files keep their server-only work (cache seeding, metadata, params) and render a screen from a feature.
- The old `components/`, `hooks/`, `context/` and `stores/` folders stay and empty out feature by feature; whatever is left is deleted with the last feature.
- A feature's unit tests move next to its code as `*.test.ts(x)` when the feature migrates, which also takes them out of the ESLint `__tests__` blind spot. The E2E suite stays under `__tests__/e2e`.

### State

- Server data is read through plain hooks over the Query cache, with `select` where a component needs a slice. It never lives in a context or a zustand store; the Query cache is its one source of truth (offline ADR-0001).
- A context remains only to inject a scope, such as which recipe a page shows, or for compound components (`Panel`, `Carousel`, DnD).
- zustand holds client state shared across components. Stores are global; one that must start fresh per screen resets on unmount instead of being scoped through a context.
- A store both apps need lives in `shared-react/<feature>`; a store that is purely platform UI (`mobileSearchOpen`) stays in the app. A persisted store persists through the platform adapter's storage.
- Device Preferences stay server-seeded on the profile (CONTEXT.md). `useDevicePreference(key)` selects one preference from the profile query, so flipping one re-renders only its readers; setting one is an optimistic mutation. Device Kind is a platform fact and comes from the platform adapter.

### shared-react

- Organised by feature: `src/<feature>/` holds its hooks, client stores, realtime subscription and types, exported as `@norish/shared-react/<feature>`. Domains are coarser than app features: `shared-react/recipes` holds the list, filters, selection, detail, favourites, ratings and shares, and both `features/library` and `features/recipes` import it.
- Cross-cutting folders: `trpc/`, `platform/`, `offline/` (already there; it also takes `optimistic-updates.ts`, which keeps an optimistic change whose write was Queued in the Outbox, so every feature's mutations import it from there), `config/` (reference data: units, tags, categories, cuisines, recurrence, upload limits), and `reader/` (the signed-in Reader: identity, household, active allergies, permissions, Device Preferences).
- Features never import each other; cross-cutting folders never import features. Lint enforces both.
- The recipe query inputs (`filter-contract`, `list-queries`) are pure contracts, so they move to `@norish/shared/contracts`. The offline Warm Set and `shared-react/recipes` import them from there, and the server's cache seeding stops importing a React package.
- `createTRPCContext<AppRouter>()` runs once at module level in `trpc/`, so every hook imports `useTRPC`. `createTRPCProviderBundle` stays a factory for each app's config only (links, WebSocket implementation, QueryClient, outbox link) and provides that one context.
- One platform adapter, mounted once per app, carries toasts, navigation, error display, storage and Device Kind. It grows as features migrate.
- The pilot is a clean migration: groceries reads nothing from web's old contexts. So `reader/` starts in the groundwork with Device Preferences, which groceries needs; identity, household, allergies and permissions join it with library.
- The `create*Hooks` and `create*Context` factories, each app's binding files, and the `./hooks` and `./contexts` exports go away feature by feature and are gone with the last one.

### Migration

1. Groceries (the pilot).
2. Library and recipes.
3. Calendar.
4. Cookbooks.
5. Settings.
6. Imports, auth and share.

The pilot's numbers do not gate the rest: the sharing goal stands on its own. A problem with the shape itself amends this spec before the second feature starts. The mobile rewrite builds each screen once its feature has migrated, and mobile's catch-up spec line "Web keeps its current layout" points here.

### Measurement

Measured on groceries before and after the pilot, as absolute numbers:

- Mounts and re-renders per component for each scripted action: check an item, add an item, open the edit panel, switch view mode, and a realtime echo from a second client. Every remaining re-render is traced to a real change on screen.
- First paint of `/groceries` through `measure-page-loads.ts`; it must not get worse.
- Route JS of `/groceries` from `next build`.
- Code shape: folders one feature spans, lines per app versus shared-react, binding files deleted, and how many lines mobile would write to get groceries.

The render counter is a committed script next to `measure-page-loads.ts`.

### Docs

- CONTRIBUTING.md gains an "App architecture" section after "Project Structure" with the rules above and one line of why each; "Project Structure" shows the `features/` folders. AGENTS.md gets a one-line pointer.
- An "Architecture" page in the docs' Development section explains the whole system at a high level: folder structure, what goes where, the decisions (linking their ADRs) and how a read, a write and a realtime update flow. CONTRIBUTING.md's rules link to it.
- No ADR: the guide states the rules and their reasons.
- The 0.27.0-beta release notes get one line saying the app architecture changed.

## Testing Decisions

- A good test drives a hook or store through its public interface and asserts what a caller observes: the data returned, what the cache holds after a mutation or a realtime event, what a store holds after an action. Never internal calls.
- shared-react's existing groceries, stores and pantry suites (`store-prices-pending`, `store-aisles`, `pantry`) move next to the code and run against the plain hooks.
- Each new zustand store gets a small unit test of its actions.
- The groceries, pantry, aisles, prices and versions E2E specs run unchanged and must stay green. They are the proof that behaviour didn't move.
- Every new test is checked with repeated runs; a test that only passes on re-run is a bug to fix.

## Out of Scope

- Migrating any feature after groceries in this ticket set.
- Moving web into `src/`.
- Visual or behavioural changes to groceries.
- New mobile screens; the mobile rewrite follows its own design track.
