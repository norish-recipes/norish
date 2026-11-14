# Contributing to Norish

Thank you for your interest in contributing to Norish! This guide will help you get started with development.

## Prerequisites

- **Node.js** 26 (see `.nvmrc`)
- **pnpm** 12.x
- **uv** 0.13 or later (installs the recipe parser's Python 3.15)
- **Docker** (for PostgreSQL, Valkey, and Obscura)
- **Git**

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/norish-recipes/norish.git
cd norish
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local configuration. At minimum, you need:

- `DATABASE_URL` - PostgreSQL connection string
- `VALKEY_URL` - Valkey connection string
- `AUTH_URL` - Your local URL (e.g., `http://localhost:3000`)
- `MASTER_KEY` - Generate with `openssl rand -base64 32`

### 4. Start Required Services

```bash
pnpm run docker:up
```

That starts PostgreSQL, Valkey, and Obscura, the browser that renders pages for
URL imports, so nothing has to be launched by hand. `pnpm run docker:down`
stops them again.

### 5. Run Development Server

```bash
pnpm dev
```

## Development Commands

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `pnpm dev`           | Start development server with hot reload |
| `pnpm dev:mobile`    | Start the Expo app (`apps/mobile`)       |
| `pnpm build`         | Create production build                  |
| `pnpm start`         | Run production server                    |
| `pnpm test`          | Run tests via Turbo (all workspaces)     |
| `pnpm test:run`      | Alias for `pnpm test`                    |
| `pnpm test:coverage` | Run tests with coverage report           |
| `pnpm lint`          | Check for linting errors                 |
| `pnpm typecheck`     | Type-check every workspace               |
| `pnpm format`        | Format every workspace with Prettier     |
| `pnpm format:check`  | Check formatting without changes         |
| `pnpm i18n:check`    | Check for missing locale keys            |
| `pnpm db:push`       | Push schema changes to database          |

## Project Structure

```
norish/
├── apps/                 # App workspaces
│   ├── web/              # Next.js app (App Router + server entry)
│   │   ├── app/          # Routes
│   │   ├── components/imports/ # Shared recipe import UI
│   │   └── features/     # One folder per feature
│   │       ├── account/
│   │       ├── admin/
│   │       ├── auth/
│   │       ├── calendar/
│   │       ├── groceries/
│   │       ├── household/
│   │       ├── ingredients/
│   │       ├── library/
│   │       └── recipes/
│   ├── mobile/           # Expo app (@norish/mobile)
│   │   └── src/          # Routes and features, as on web
│   ├── parser-api/       # Python service around recipe-scrapers
│   ├── docs/             # Docs site (docs.norish.dev)
│   ├── landing/          # Landing page (norish.dev)
│   └── quick-import-extension/ # Browser extension, a git submodule
├── packages/             # Shared libraries
│   ├── api/              # Server startup, import parser, CalDAV sync, video
│   ├── auth/             # Auth helpers
│   ├── config/           # Shared config
│   ├── db/               # Repositories, migrations, Drizzle client
│   ├── db-schema/        # Drizzle table definitions
│   ├── i18n/             # Locale tooling and data
│   ├── queue/            # Background jobs
│   ├── shared/           # Shared utilities and contracts
│   ├── shared-react/     # React logic both apps share, by domain
│   ├── shared-server/    # Shared server utilities
│   ├── trpc/             # tRPC router definitions
│   └── ui/               # UI component library
├── tooling/              # Repo tooling
│   ├── eslint/           # @norish/eslint-config
│   ├── github/           # Shared GitHub Actions composite actions
│   ├── ingredient-icons/ # Draws the Ingredient Icons Norish ships
│   ├── monorepo/         # Circular dependency checks
│   ├── nutrition/        # Builds the nutrition source table
│   ├── prettier/         # @norish/prettier-config
│   ├── tailwind/         # @norish/tailwind-config
│   └── typescript/       # @norish/tsconfig
└── docker/               # Local runtime containers
```

## App architecture

Web and mobile use the same layout and share logic in `packages/shared-react`. [Architecture](https://docs.norish.dev/development/architecture) in the docs shows where each piece lives and traces a read, a write and a realtime update through it.

- Web features cover `library` (with the cookbook page), `recipes` (with the shared recipe page), `groceries`, `calendar`, `account`, `household`, `ingredients`, `admin` and `auth`. `features/<feature>/` holds its screens, components and hooks. Auth holds the login, signup and auth-error screens; `app/(auth)/` keeps the layout, `loading.tsx` files and each page's server work. Route files in `app/` render screens from features, and a page that shows several, such as the dashboard, composes them. The settings route composes `account`, `household`, `ingredients`, `admin` and CalDAV in `calendar`; each tab has its own route and screen. Shared settings UI lives in `components/settings/`. Mobile's `smoke` isn't a domain: it is a throwaway screen that tests the plumbing until the redesigned screens replace it.
- Features never import each other. Lint blocks `@/features/<x>` and `@/features/<x>/**` outside feature `<x>`, except in route files. A panel several features open lives in the shared `components/Panel/consumers/` folder.
- A feature's components are grouped by area (`list/`, `panels/`, `stores/`). An area's `index.ts` re-exports only pieces more than one screen draws; import a piece one screen draws by file, and omit the index when nothing is shared. The bundler ships every file an index re-exports, so mixing pieces puts one screen's code in another's chunk.
- Skeletons, `loading.tsx` files and the shared recipe page import files directly, never through an area's `index.ts`. Importing directly cut the recipe skeleton's own code from 324 KB to 38 KB.
- Each layout seeds only what its screens draw in the first frame, and some seeded reads are reread once their subscriptions are live to cover changes made before registration. `(app)` seeds permissions and Device Preferences; `(library)` and the recipe layout seed favourites, the household and the reader's allergies through `lib/reader-recipe-seeds.ts`; `(dashboard)` seeds pending imports. The shell reads the Reader's profile (`user.get`) itself. Seeds arrive only on a full document load; in-app navigations carry none.
- Views that share a layout, as the grocery list and the Pantry do, are drawn by one root the layout renders, which picks the view from the address, so a switch stays on the client. The layout seeds only the view a full load opens on; each page just gives its view an address.
- Code two or more features use goes in the app's shared `components/`, `hooks/` or `lib/`, so no feature imports it from another. `components/imports/` holds the URL, paste and image import modals, the copied-link prompt and `use-import-recipe`. The library header and shell open the import UI. Imports run one way: shared folders, then features, then routes.
- Components never call tRPC. Every read and write uses a named shared-react hook in its domain; `restrictTRPC` in `tooling/eslint/features.ts` bans `useTRPC` and `useTRPCClient` in both apps, with named exceptions when needed (none today). The hooks are reusable by both apps.
- Server-only work, such as repository reads, seeds and redirects, stays in route folders, so features remain client-facing.
- A shared-react hook passes toast messages in namespaces shipped by web's root layout; `root-messages.test.ts` guards them.
- Components read server data through plain hooks over the TanStack Query cache, with `select` for a slice, and never copy it into a context or a store. The cache stays the one source of truth, which offline mode persists ([ADR-0001](docs/adr/offline/0001-web-offline-is-a-persisted-query-cache.md)), and a component re-renders only when its slice changes.
- Use generated builders (`queryKey()`, `mutationKey()`, `pathKey()`, `pathFilter()`, `queryFilter()`, `infiniteQueryKey()`) for tRPC query keys and a named constant for a non-tRPC query key; lint reports hand-written keys, and a key that matches no query fails silently. Match a list read as an infinite query with `pathKey()`, not `queryKey()` with no input.
- A list rebuilt from changed data keeps each unchanged item's object, as the Query cache does, and memoises its rows, so a change renders only the rows it touches.
- A write's rollback and settle go in `useMutation`'s own options, never in a `mutate` call, whose callbacks run for the last call only, so an overlapped failure would keep its optimistic change.
- The component that draws data mounts its subscriptions: a feature root for its screens, a panel while open, and the shell for its own data and the Reader. A screen also mounts subscriptions for other domains it draws, so unused pages don't stay subscribed. The shell mounts the Reader's household and permissions, admin config, `useRecipeOutcomesSubscription` and the archive import outcome, each showing its own toasts through the platform adapter. Library's root mounts recipe list events, ratings, cookbooks and the Pantry. Calendar's root and today's meals on the dashboard mount calendar events and recipe updates. The editor also mounts recipe list events, which reread its category choices, and Add to Groceries mounts the subscription of the recipe it draws. The Account screen mounts archive import progress for its bar. A component inside `Panel` mounts its reads and subscriptions while open and through the exit animation. Each opening rereads data nothing kept current; hooks need no `enabled` or `open` flag. A subscription names its reads with `useKeepsCurrent`, so web doesn't read them again on mount until they go stale. A mounted subscription vouches only for a read that arrived after it mounted, so a read from before a gap in its subscription is fetched again. A subscription mounting with the screen rereads its `liveQueryKeys` once live. A reread waits until no write is pending, and one an optimistic write cancels runs again then. A write waiting in the Outbox does not count as pending.
- A context only hands down a per-page store or wires compound components such as `Panel`. Every consumer re-renders when its value changes, so it holds nothing that changes often.
- Client state several components share goes in a zustand store, and state one component owns stays in `useState`. Each component subscribes to the fields it reads, so a change re-renders only those components. A store holds ids, never a copy of server data, which would go stale.
- A store is global unless its first value comes from the request or the page. A component reads a global store without a provider above it, and one that must start fresh on each screen resets on unmount. A persisted store persists through the platform adapter's storage, so the same store runs on web and mobile.
- A store whose first value comes from the request or the page, such as the recipe page's recipe id, belongs to the page: the page's provider creates it once with zustand's `createStore` and hands it down through a context that holds only the store, and components read it with a selector. A module-level store is one object on the server, shared by every request, so it can't hold one page's recipe while the server renders.
- shared-react groups code by domain, including `admin` and `ingredients`, coarser than the app features: `recipes` holds the list, filters, selection, detail and cookbooks that `library` and `recipes` import, plus `useImportMutations` alongside `useRecipesMutations`. `src/<domain>/` holds its hooks, client stores, realtime subscription and types, exported as `@norish/shared-react/<domain>`, so a mobile screen reuses what web uses and adds only its UI. Domains never import each other, and the cross-cutting folders they import never import a domain, so changing one domain never breaks the rest, and lint enforces both. The cross-cutting folders:
  - `trpc/` creates the one tRPC context, so every hook imports `useTRPC` directly with no factory to bind in each app.
  - `platform/` is the one adapter each app mounts for toasts, navigation, errors, storage, Device Kind, the session, `endSession(scope)` (`"everywhere"` or `"device"`), `leave(reason)` and the offline engine clear, so shared code holds no web or mobile imports.
  - `offline/` holds the Outbox and the optimistic updates every domain's mutations use, so every write is Queued and replayed the same way while Offline.
  - `config/` holds `useAuthProvidersQuery` and reference data such as units, tags and recurrence, which every domain reads and none owns.
  - `reader/` holds the signed-in Reader and Account: identity, household, profile, allergies, Sign-in Methods, site tokens, their writes, permissions and Device Preferences, which every domain checks without fetching its own copy. `reader/session-end.ts` holds `useSignOut`, `useSessionExpiry` and `expireSession`, each app's 401 and 4401 callback. Web mounts `useSessionExpiry` in the signed-in shell; mobile mounts it in `AuthProviders` from sign-in until leaving. Web's sign-in screen forgets the Offline Cache when reached with a `callbackUrl`, except after sign-out.
  - `realtime/` holds the hook every domain's realtime subscription is built on, so each one rereads once live and recovers from a lag the same way.
  - `page-store/` provides `createPageStoreContext`, which returns a provider that creates a store once from the page's key and a hook that selects a slice of it.

## Script Ownership

- Root `package.json` scripts are orchestration only and delegate into owned workspaces.
- Monorepo control scripts live in `tooling/monorepo/scripts/`.
- App-owned scripts live in `apps/<app>/scripts/`.
- Package-owned scripts live in `packages/<package>/scripts/`.

## Shared Tooling Packages

- Shared lint, format, and TypeScript settings are published as workspace packages under `tooling/`.
- Workspaces should compose from these packages instead of creating root-level config files.
- Current shared packages:
  - `@norish/eslint-config` (`tooling/eslint`) with `base`, `react`, `nextjs`, and `features` exports
  - `@norish/prettier-config` (`tooling/prettier`)
  - `@norish/tsconfig` (`tooling/typescript`) with `base.json` and `compiled-package.json`
  - `@norish/tailwind-config` (`tooling/tailwind`) with `theme` and `postcss-config` exports

### Adding a New Shared Config

1. Create or update a workspace package under `tooling/` with a `package.json` and explicit `exports`.
2. Add the package to `pnpm-workspace.yaml` and consume it via `workspace:*` from each owning workspace.
3. Wire each workspace through local `package.json` scripts (for example `lint`, `format`, `typecheck`) and local config files that import shared config exports.
4. Run `pnpm run deps:cycles` and relevant `turbo run` checks before opening a PR.

## Code Style Guidelines

### Imports

Always use the `@/` path alias for imports:

```typescript
// Good
import { useLibraryList } from "@/features/library/hooks/use-library";

// Bad
import { useLibraryList } from "../../../features/library/hooks/use-library";
```

### Type Safety

Never suppress TypeScript errors:

```typescript
// Never use these
as any
@ts-ignore
@ts-expect-error
```

### Logging

Use Pino logger instead of `console.log`:

```typescript
// Server-side
import { createLogger } from "@norish/shared-server/logger";

// Client-side
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createLogger("my-module");
log.info("Something happened");

const log = createClientLogger("MyComponent");
```

### React

Web, mobile, `packages/shared-react` and `packages/ui` compile with the React Compiler, which memoises components and hooks itself:

- Don't write `useMemo` or `useCallback`; the compiler memoises. The one exception is a value an effect depends on that must keep its identity, with a one-line comment saying so. A component marked `"use no memo"`, such as a TanStack Virtual list, keeps its own, since the compiler skips it.
- Keep a hook's `use` prefix when you alias it (`const useX = hooks.useX`). The compiler knows a hook only by its name.
- Derive values during render instead of copying them into state from an effect. The lint flags state set in an effect, refs read during render, and mutated props.
- Lint reports every component or hook the compiler skips, through `eslint-plugin-react-hooks`. Fix the code rather than silence it; one that must stay uncompiled, such as a TanStack Virtual list, opens with `"use no memo"`.

### Database Access

Always use the repository pattern:

```typescript
// Good - use repository
import { getRecipeById } from "@/server/db/repositories/recipes";

const recipe = await getRecipeById(id);

// Bad - direct db access in routers
const recipe = await db.select().from(recipes).where(eq(recipes.id, id));
```

### Naming Conventions

- **Hooks**: `use-{domain}-{type}.ts` (e.g., `use-recipes-query.ts`)
- **Components**: PascalCase (e.g., `RecipeCard.tsx`)
- **Files**: kebab-case (e.g., `recipe-card.tsx`)

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clear, focused commits
- Follow the code style guidelines
- Add tests for new functionality
- Add browser E2E coverage when a user-visible workflow depends on browser behavior for its acceptance criteria

### 3. Test Your Changes

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm i18n:check
pnpm build
```

For an affected web workflow, the browser E2E suites are also a required gate and must pass before the work is complete. One command builds and runs them all (it is also enforced by CI on every PR and before every RC/release image):

```bash
pnpm test:e2e
```

An unavailable or environmentally blocked browser run is reported as blocked, not treated as passing acceptance evidence.

### 4. Submit a Pull Request

- Follow the PR template
- Link the PR to an issue (`Fixes #...` in the PR body)
- PRs without a linked issue will be closed, except translation-only PRs
  (maintainer PRs may reference a Linear issue id such as `GEZ-46` instead)
- Ensure CI checks pass

## Testing

Tests live in `__tests__/` directories: a workspace's own (e.g., `apps/web/__tests__/...`, `apps/mobile/__tests__/...`, `packages/shared/__tests__/...`), or a feature's (`apps/web/features/groceries/__tests__/`, `apps/mobile/src/features/auth/__tests__/`, `packages/shared-react/src/groceries/__tests__/`), one flat folder per feature. Mobile's shared tests mirror `src/` without the `src/` segment, such as `src/lib/auth/x.ts` in `__tests__/lib/auth/x.test.ts`. We use Vitest with React Testing Library.

User-visible workflows whose acceptance criteria depend on browser behavior require production-like browser E2E coverage. Keep third-party dependencies deterministic at their narrow external boundary while exercising the real Norish application path. Backend-only changes do not require browser E2E unless their acceptance criteria explicitly cross that boundary.

```bash
# Run all tests
pnpm test:run

# Run tests for a specific workspace
pnpm --filter @norish/web run test

# Run a specific test file (from within the workspace directory)
cd apps/web && pnpm exec vitest run __tests__/hooks/use-recipes-mutations.test.tsx

# Build once and run the complete browser E2E gate (Offline + AI + Realtime projects)
pnpm test:e2e

# Run one project against an existing production build
pnpm --filter @norish/web run test:e2e --project=offline
pnpm --filter @norish/web run test:e2e --project=ai
pnpm --filter @norish/web run test:e2e --project=realtime

# A build for a base path runs only the base-path project
NEXT_PUBLIC_BASE_PATH=/norish pnpm run build --filter=@norish/web...
pnpm --filter @norish/web run test:e2e
```

### Mobile app flows (Maestro)

The flows in `apps/mobile/maestro/` drive the iOS app against a throwaway server. They run on your machine only; CI does not run them. You need [Maestro](https://maestro.dev), Docker, Xcode and a booted iPhone simulator.

```bash
# 1. Build the web app, which the flows' server runs
pnpm build:web

# 2. Build the app and install it in the booted simulator. A Release build carries its
#    own bundle, so the flows need no Metro server.
pnpm --filter @norish/mobile ios --configuration Release

# 3. Run every flow
pnpm --filter @norish/mobile maestro
```

Step 3 starts the web build with throwaway Postgres and Valkey containers, so rebuild after a server change. It signs up `maestro@norish.test` and runs the flows, then runs the flows in `apps/mobile/maestro/old-server/`. The flows cover offline launch, sign-in, sign-up, sign-out, session expiry and server version checks, and the Recipes tab: browse and filter, planning, groceries, cookbooks, delete, import from a link, offline replay and realtime. Each Recipes flow seeds its own recipes through the script's control port; import from a link reads a recipe page the script serves on loopback.

To use a running server, set `NORISH_SERVER_URL`. If registration is closed, create the account first or set `NORISH_EMAIL` and `NORISH_PASSWORD` for an existing account. The script opens registration if needed and attempts to restore it afterward. The account must be an admin to open registration. The script also turns off password AutoFill prompts on the simulator. Set `NORISH_SIMULATOR` to a simulator UDID when several are booted.

The offline flows use a proxy on port 3998, controlled through port 3997 (`NORISH_PROXY_PORT` and `NORISH_PROXY_CONTROL_PORT`). The version proxy on port 3999 (`NORISH_OLD_SERVER_PORT`) forwards to the same server. Calls to `/old` and `/real` on the control port switch between an old version and the real version. The control port also lets the session expiry flow revoke the app's session.

Pass a flow path to run just that flow with the same setup:

```bash
pnpm --filter @norish/mobile maestro maestro/sign-up.yaml
```

## Adding Translations

Norish uses a configurable locale system. The bundled locale catalog lives in `packages/i18n/src/locales.ts`, server defaults are derived from that catalog in `packages/shared-server/src/config/server-config-loader.ts`, and locales can be enabled/disabled at runtime via the Admin UI or environment variables.

### 1. Add Locale to the Bundled Locale Catalog

Edit `packages/i18n/src/locales.ts` to add the new locale metadata:

```typescript
export const LOCALE_CATALOG = {
  en: { name: "English" },
  nl: { name: "Nederlands" },
  "de-formal": { name: "Deutsch (Sie)" },
  "de-informal": { name: "Deutsch (Du)" },
  "your-locale": { name: "Your Language" },
} as const;
```

This is the single source of truth for bundled locale metadata used by web, mobile fallback, and server defaults.

### 2. Create Translation Files

Create a new folder `packages/i18n/src/messages/{your-locale}/` with the following files:

- `common.json` - Common UI strings
- `recipes.json` - Recipe-related strings
- `groceries.json` - Grocery list strings
- `calendar.json` - Calendar strings
- `settings.json` - Settings page strings
- `navbar.json` - Navigation strings
- `auth.json` - Authentication strings

Copy the structure from `packages/i18n/src/messages/en/` as a starting point.

### 2.1 Register Message Loaders (Required for Web and Mobile)

Expo Metro does not support fully dynamic JSON imports for locale bundles.
After adding a new locale folder, update `packages/i18n/src/messages.ts` and add static loader entries for every section (`common`, `recipes`, `groceries`, `calendar`, `settings`, `navbar`, `auth`) under `MESSAGE_LOADERS`.

If you skip this, iOS/Android bundling can fail with an "Invalid call" error from dynamic `import(...)`.

### 2.2 Teach Norish the Language's Words

Recipes and groceries are read in every language, so add your language's words too:

- `packages/config/src/units.default.json` - unit names (a test fails when one is missing)
- `packages/config/src/timer-keywords.default.json` - hour, minute and second words
- `packages/config/src/ingredient-words.default.json` - preparation, size and joining words
- `packages/config/src/recurrence-config.default.json` - "every week" and weekday words
- `packages/config/src/content-indicators.default.json` - words that mark a recipe page
- `packages/shared/src/lib/ingredient-names.ts` (`CATALOGUE_LANGUAGES`) and `packages/shared-server/src/ingredients/seed/junk-pile.ts` - catalogue names and text that is not a food

### 3. Verify Translations

Run the locale check to ensure all keys are present:

```bash
pnpm i18n:check
```

This command uses `en` as the source of truth and reports:

- **Missing keys**: Keys that exist in `en` but not in your locale (CI will fail)
- **Extra keys**: Keys in your locale that don't exist in `en` (warning only)

The check runs automatically in CI and will block PRs with missing translations.

### 4. Enable the Locale

New locales are **enabled by default** once added to `LOCALE_CATALOG` and wired into `packages/i18n/src/messages.ts`. You can also control runtime availability via:

- **Admin UI**: Go to **Settings => Admin => General** to enable/disable locales
- **Environment variable**: Set `ENABLED_LOCALES=en,nl,your-locale` (comma-separated list)

## License

By contributing to Norish, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
