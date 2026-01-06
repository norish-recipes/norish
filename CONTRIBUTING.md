# Contributing to Norish

Thank you for your interest in contributing to Norish! This guide will help you get started with development.

## Prerequisites

- **Node.js** 22.x or later
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
| `pnpm build`         | Create production build                  |
| `pnpm start`         | Run production server                    |
| `pnpm test`          | Run tests in watch mode                  |
| `pnpm test:run`      | Run tests once                           |
| `pnpm test:coverage` | Run tests with coverage report           |
| `pnpm lint`          | Check for linting errors                 |
| `pnpm lint:fix`      | Fix linting errors automatically         |
| `pnpm format`        | Format code with Prettier                |
| `pnpm format:check`  | Check formatting without changes         |
| `pnpm i18n:check`    | Check for missing locale keys            |
| `pnpm db:push`       | Push schema changes to database          |

## Project Structure

```
norish/
├── app/              # Next.js App Router pages
│   ├── (app)/        # Authenticated pages
│   ├── (auth)/       # Login/signup pages
│   └── api/          # API routes
├── components/       # React components (HeroUI + Tailwind)
├── context/          # React contexts
├── hooks/            # React hooks organized by domain
├── server/           # Backend code
│   ├── auth/         # Authentication (Better Auth)
│   ├── db/           # Database (Drizzle ORM)
│   ├── trpc/         # tRPC routers
│   └── queue/        # Background jobs (BullMQ)
├── i18n/             # Internationalization
│   ├── config.ts     # Locale configuration
│   └── messages/     # Translation files
├── types/            # TypeScript types and DTOs
└── tooling/          # ESLint, Vitest, Tailwind configs
```

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
import { createLogger } from "@/server/logger";
const log = createLogger("my-module");
log.info("Something happened");

// Client-side
import { createClientLogger } from "@/lib/logger";
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

- Provide a clear description of the changes
- Reference any related issues
- Ensure CI checks pass

## Testing

Tests are located in `__tests__/` and mirror the source structure. We use Vitest with React Testing Library.

```bash
# Run all tests
pnpm test:run

# Run specific test file
pnpm test:run __tests__/hooks/recipes/use-recipes-query.test.ts

# Watch mode
pnpm test
```

## Adding Translations

Norish uses a configurable locale system. Locales are defined in code but can be enabled/disabled at runtime via the Admin UI or environment variables.

### 1. Add Locale to ALL_LOCALES

Edit `i18n/config.ts` to add the new locale code:

```typescript
export const ALL_LOCALES = ["en", "nl", "de-formal", "de-informal", "your-locale"] as const;

export const ALL_LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
  "de-formal": "Deutsch (Sie)",
  "de-informal": "Deutsch (Du)",
  "your-locale": "Your Language",
};
```

### 2. Create Translation Files

Create a new folder `i18n/messages/{your-locale}/` with the following files:

- `common.json` - Common UI strings
- `recipes.json` - Recipe-related strings
- `groceries.json` - Grocery list strings
- `calendar.json` - Calendar strings
- `settings.json` - Settings page strings
- `navbar.json` - Navigation strings
- `auth.json` - Authentication strings

Copy the structure from `i18n/messages/en/` as a starting point.

### 3. Verify Translations

Run the locale check to ensure all keys are present:

```bash
pnpm i18n:check
```

This command uses `en` as the source of truth and reports:

- **Missing keys**: Keys that exist in `en` but not in your locale (CI will fail)
- **Extra keys**: Keys in your locale that don't exist in `en` (warning only)

The check runs automatically in CI and will block PRs with missing translations.

### 4. Add Locale to Default Config

Add the locale entry to `DEFAULT_LOCALE_CONFIG` in `config/server-config-loader.ts`:

```typescript
export const DEFAULT_LOCALE_CONFIG: I18nLocaleConfig = {
  defaultLocale: "en",
  locales: {
    en: { name: "English", enabled: true },
    nl: { name: "Nederlands", enabled: true },
    "de-formal": { name: "Deutsch (Sie)", enabled: true },
    "de-informal": { name: "Deutsch (Du)", enabled: true },
    "your-locale": { name: "Your Language", enabled: true },
  },
};
```

This is the single source of truth - `seed-config.ts` imports from here automatically.

### 5. Enable the Locale

New locales are **disabled by default** until enabled via one of these methods:

- **Admin UI**: Go to **Settings => Admin => General** and check the locale checkbox
- **Environment variable**: Set `ENABLED_LOCALES=en,nl,your-locale` (comma-separated list)

## License

By contributing to Norish, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
