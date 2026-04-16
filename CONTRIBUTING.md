# Contributing to Norish

Thank you for your interest in contributing to Norish! This guide will help you get started with development.

## Prerequisites

- **Node.js** 22.22.0 (see `.nvmrc`)
- **pnpm** 10.x or later
- **Docker** (for PostgreSQL and Redis)
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
- `REDIS_URL` - Redis connection string
- `AUTH_URL` - Your local URL (e.g., `http://localhost:3000`)
- `MASTER_KEY` - Generate with `openssl rand -base64 32`

### 4. Start Required Services

```bash
docker run -d --name norish-db -e POSTGRES_PASSWORD=norish -e POSTGRES_DB=norish -p 5432:5432 postgres:17-alpine
docker run -d --name norish-redis -p 6379:6379 redis:8-alpine
```

### 5. Run Development Server

```bash
pnpm dev
```

## Development Commands

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `pnpm dev`           | Start development server with hot reload |
| `pnpm dev:mobile`    | Start Expo mobile workspace              |
| `pnpm build`         | Create production build                  |
| `pnpm start`         | Run production server                    |
| `pnpm test`          | Run tests via Turbo (all workspaces)     |
| `pnpm test:run`      | Alias for `pnpm test`                    |
| `pnpm test:coverage` | Run tests with coverage report           |
| `pnpm lint`          | Check for linting errors                 |
| `pnpm format`        | Check formatting with Prettier           |
| `pnpm format:check`  | Check formatting without changes         |
| `pnpm i18n:check`    | Check for missing locale keys            |
| `pnpm db:push`       | Push schema changes to database          |

## Project Structure

```
norish/
├── apps/             # App workspaces
│   ├── web/          # Next.js app (App Router + server entry)
│   └── mobile/       # Expo app workspace (@norish/mobile)
├── packages/         # Shared libraries
│   ├── api/          # Server API logic (routers, AI, parsing)
│   ├── auth/         # Auth helpers
│   ├── config/       # Shared config
│   ├── db/           # Drizzle schema + repositories
│   ├── i18n/         # Locale tooling and data
│   ├── queue/        # Background jobs
│   ├── shared/       # Shared utilities and contracts
│   ├── shared-react/ # Shared React hooks and contexts
│   ├── shared-server/# Shared server utilities
│   ├── trpc/         # tRPC router definitions
│   └── ui/           # UI component library
├── tooling/          # Repo tooling
│   ├── eslint/        # @norish/eslint-config
│   ├── github/        # Shared GitHub Actions composite actions
│   ├── monorepo/      # Circular dependency checks
│   ├── prettier/      # @norish/prettier-config
│   ├── tailwind/      # @norish/tailwind-config
│   └── typescript/    # @norish/tsconfig
└── docker/           # Local runtime containers
```

## Script Ownership

- Root `package.json` scripts are orchestration only and delegate into owned workspaces.
- Monorepo control scripts live in `tooling/monorepo/scripts/`.
- App-owned scripts live in `apps/<app>/scripts/`.
- Package-owned scripts live in `packages/<package>/scripts/`.

## Shared Tooling Packages

- Shared lint, format, and TypeScript settings are published as workspace packages under `tooling/`.
- Workspaces should compose from these packages instead of creating root-level config files.
- Current shared packages:
  - `@norish/eslint-config` (`tooling/eslint`) with `base`, `react`, and `nextjs` exports
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
import { useRecipesContext } from "@/context/recipes-context";

// Bad
import { useRecipesContext } from "../../../context/recipes-context";
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

// Client-side
import { createClientLogger } from "@/lib/logger";
import { createLogger } from "@/server/logger";

const log = createLogger("my-module");
log.info("Something happened");

const log = createClientLogger("MyComponent");
```

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

### 3. Test Your Changes

```bash
pnpm lint
pnpm test:run
pnpm i18n:check
pnpm build
```

### 4. Submit a Pull Request

- Follow the PR template
- Link the PR to an issue (`Fixes #...` in the PR body)
- PRs without a linked issue will be closed, except translation-only PRs
- Ensure CI checks pass

## Testing

Tests are colocated in workspace `__tests__/` directories (e.g., `apps/web/__tests__/...`, `packages/shared/__tests__/...`). We use Vitest with React Testing Library.

```bash
# Run all tests
pnpm test:run

# Run tests for a specific workspace
pnpm --filter @norish/web run test

# Run a specific test file (from within the workspace directory)
cd apps/web && pnpm exec vitest run __tests__/hooks/recipes/use-recipes-query.test.ts
```

## Adding Translations

Norish uses a configurable locale system. The bundled locale catalog lives in `packages/i18n/src/locales.ts`, server defaults are derived from that catalog in `packages/config/src/server-config-loader.ts`, and locales can be enabled/disabled at runtime via the Admin UI or environment variables.

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
