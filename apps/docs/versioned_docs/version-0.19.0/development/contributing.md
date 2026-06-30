---
sidebar_position: 3
title: Contributing
description: Project structure, code style, the pull-request process, and how to add translations.
---

# Contributing

Thanks for your interest in contributing to Norish! This guide covers the
conventions and processes once your [development environment](./setup.md) is up.

## Project structure

```
norish/
├── apps/             # App workspaces
│   ├── web/          # Next.js app (App Router + server entry)
│   ├── mobile/       # Expo app workspace (@norish/mobile)
│   ├── parser-api/   # Python recipe parser service
│   ├── landing/      # Marketing site (norish.dev)
│   └── docs/         # This documentation site (docs.norish.dev)
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

## Script ownership

- Root `package.json` scripts are orchestration only and delegate into owned workspaces.
- Monorepo control scripts live in `tooling/monorepo/scripts/`.
- App-owned scripts live in `apps/<app>/scripts/`.
- Package-owned scripts live in `packages/<package>/scripts/`.

## Shared tooling packages

- Shared lint, format, and TypeScript settings are published as workspace packages under `tooling/`.
- Workspaces should compose from these packages instead of creating root-level config files.
- Current shared packages:
  - `@norish/eslint-config` (`tooling/eslint`) with `base`, `react`, and `nextjs` exports
  - `@norish/prettier-config` (`tooling/prettier`)
  - `@norish/tsconfig` (`tooling/typescript`) with `base.json` and `compiled-package.json`
  - `@norish/tailwind-config` (`tooling/tailwind`) with `theme` and `postcss-config` exports

### Adding a new shared config

1. Create or update a workspace package under `tooling/` with a `package.json` and explicit `exports`.
2. Add the package to `pnpm-workspace.yaml` and consume it via `workspace:*` from each owning workspace.
3. Wire each workspace through local `package.json` scripts (for example `lint`, `format`, `typecheck`) and local config files that import shared config exports.
4. Run `pnpm run deps:cycles` and relevant `turbo run` checks before opening a PR.

## Code style

### Imports

Always use the `@/` path alias for imports:

```typescript
// Good
import { useRecipesContext } from "@/context/recipes-context";

// Bad
import { useRecipesContext } from "../../../context/recipes-context";
```

### Type safety

Never suppress TypeScript errors — avoid `as any`, `@ts-ignore`, and
`@ts-expect-error`.

### Logging

Use the Pino logger instead of `console.log`:

```typescript
// Server-side
import { createLogger } from "@/server/logger";

const log = createLogger("my-module");
log.info("Something happened");

// Client-side
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("MyComponent");
```

### Database access

Always use the repository pattern instead of direct `db` access in routers:

```typescript
// Good — use a repository
import { getRecipeById } from "@/server/db/repositories/recipes";

const recipe = await getRecipeById(id);
```

### Naming conventions

- **Hooks**: `use-{domain}-{type}.ts` (e.g. `use-recipes-query.ts`)
- **Components**: PascalCase (e.g. `RecipeCard.tsx`)
- **Files**: kebab-case (e.g. `recipe-card.tsx`)

## Pull request process

1. **Create a branch** — `feature/your-feature-name` or `fix/your-bug-fix`.
2. **Make focused changes** — clear commits, follow the code style, add tests for new functionality.
3. **Test your changes**:
   ```bash
   pnpm lint
   pnpm test:run
   pnpm i18n:check
   pnpm build
   ```
4. **Open a PR** — follow the PR template and link an issue (`Fixes #...` in the body).
   PRs without a linked issue will be closed, except translation-only PRs. Ensure CI passes.

## Testing

Tests are colocated in workspace `__tests__/` directories (e.g.
`apps/web/__tests__/...`). We use Vitest with React Testing Library.

```bash
# Run all tests
pnpm test:run

# Run tests for a specific workspace
pnpm --filter @norish/web run test

# Run a specific test file (from within the workspace directory)
cd apps/web && pnpm exec vitest run __tests__/hooks/recipes/use-recipes-query.test.ts
```

## Adding translations

Norish uses a configurable locale system. The bundled catalog lives in
`packages/i18n/src/locales.ts`, server defaults are derived from it in
`packages/config/src/server-config-loader.ts`, and locales can be
enabled/disabled at runtime via the Admin UI or environment variables.

### 1. Add the locale to the catalog

Edit `packages/i18n/src/locales.ts`:

```typescript
export const LOCALE_CATALOG = {
  en: { name: "English" },
  nl: { name: "Nederlands" },
  "your-locale": { name: "Your Language" },
} as const;
```

This is the single source of truth for bundled locale metadata used by web,
mobile fallback, and server defaults.

### 2. Create translation files

Create `packages/i18n/src/messages/{your-locale}/` with these files, copying the
structure from `packages/i18n/src/messages/en/` as a starting point:

`common.json`, `recipes.json`, `groceries.json`, `calendar.json`,
`settings.json`, `navbar.json`, `auth.json`.

#### Register message loaders (required for web and mobile)

Expo Metro does not support fully dynamic JSON imports for locale bundles. After
adding a locale folder, update `packages/i18n/src/messages.ts` and add static
loader entries for every section under `MESSAGE_LOADERS`. Skipping this can make
iOS/Android bundling fail with an "Invalid call" error from dynamic `import(...)`.

### 3. Verify translations

```bash
pnpm i18n:check
```

This uses `en` as the source of truth and reports **missing keys** (exist in
`en` but not your locale — CI fails) and **extra keys** (in your locale but not
`en` — warning only). The check runs in CI and blocks PRs with missing
translations.

### 4. Enable the locale

New locales are **enabled by default** once added to `LOCALE_CATALOG` and wired
into `packages/i18n/src/messages.ts`. You can also control runtime availability
via **Settings → Admin → General** or the `ENABLED_LOCALES` environment variable
(e.g. `ENABLED_LOCALES=en,nl,your-locale`).

## License

By contributing to Norish, you agree that your contributions will be licensed
under the [AGPL-3.0 License](https://github.com/norish-recipes/Norish/blob/main/LICENSE).
