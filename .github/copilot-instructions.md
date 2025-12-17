# Norish - AI Coding Instructions

## Architecture Overview

Norish is a **real-time recipe sharing app** built with Next.js 16 (App Router) + custom Express server. Key characteristics:

- **Monorepo-style structure** with shared code via `@/` path alias (maps to project root)
- **tRPC + WebSocket** for real-time sync between users in the same household
- **BullMQ workers** for background jobs (recipe import, CalDAV sync, scheduled tasks)
- **Better Auth** for authentication (SSO/OIDC/OAuth2, not NextAuth)
- **Drizzle ORM** with PostgreSQL; Redis for pub/sub and job queues

## Directory Structure

| Path | Purpose |
|------|---------|
| `server/` | Backend: tRPC routers, auth, DB, queue workers, AI, CalDAV |
| `app/(app)/` | Authenticated pages (recipes, groceries, calendar, settings) |
| `app/(auth)/` | Login/auth pages |
| `hooks/` | React hooks organized by domain (`hooks/recipes/`, `hooks/groceries/`) |
| `context/` | React contexts for global state (household, permissions, user) |
| `lib/` | Shared utilities usable on client AND server |
| `config/` | Server config loading (`env-config-server.ts` is server-only) |
| `types/dto/` | TypeScript DTOs shared between client/server |
| `tooling/` | ESLint and Vitest configs (re-exported from root) |

## Development Commands

```bash
pnpm dev          # Start dev server (tsx watch server.ts)
pnpm build        # Next.js build + server build (tsdown)
pnpm start        # Run production server
pnpm test         # Vitest in watch mode
pnpm test:run     # Single test run
pnpm db:push      # Push Drizzle schema to database
pnpm lint:fix     # ESLint with auto-fix
```

## Code Patterns

### tRPC Router Pattern
Routers live in `server/trpc/routers/<domain>/`. Each domain exports procedures merged into main router:

```typescript
// server/trpc/routers/recipes/index.ts
export const recipesRouter = router({
  ...recipesProcedures._def.procedures,
  ...recipesSubscriptions._def.procedures,
});
```

Use `authedProcedure` for authenticated endpoints, `serverAdminProcedure` for admin-only.

### Real-time Updates
Use typed emitters from `server/trpc/emitter.ts` for WebSocket broadcasts:

```typescript
import { createTypedEmitter } from "@/server/trpc/emitter";
emitter.emitToHousehold(householdId, "created", data);
```

### React Hooks Pattern
Domain hooks follow naming: `use-{domain}-query.ts`, `use-{domain}-mutation.ts`, `use-{domain}-subscription.ts`

```typescript
// hooks/recipes/use-recipes-query.ts
export function useRecipesQuery(filters: RecipeFilters): RecipesQueryResult
```

### Database Access
- Schema: `server/db/schema/` (Drizzle tables)
- Repositories: `server/db/repositories/` (data access layer)
- Always use repositories, not direct `db` queries in routers

### Import Paths
Always use `@/` alias for imports:
```typescript
import { db } from "@/server/db/drizzle";
import { RecipeDashboardDTO } from "@/types";
```

## Testing

Tests in `__tests__/` mirror source structure. Use test utilities from `__tests__/mocks/`:

```typescript
import { createMockContext } from "@/__tests__/trpc/recipes/test-utils";
```

## Key Integration Points

- **Auth**: `server/auth/auth.ts` (Better Auth with encrypted email storage)
- **AI Features**: `server/ai/` (recipe parsing, unit conversion) - gated by `isAIEnabled()`
- **Background Jobs**: `server/queue/` with BullMQ workers
- **CalDAV**: `server/caldav/` for calendar sync

## Permission Model

Three-tier permission policies for recipe view.
- **everyone**: All users can access
- **household**: Only owner and household members
- **owner**: Only the resource owner

For calendar and grocery items it always defaults to household-only.

Configured per-action (view/edit/delete) via `server/db/zodSchemas/server-config.ts`. Use `canAccessResource()` from `server/auth/permissions.ts`:

```typescript
const allowed = await canAccessResource("edit", userId, ownerId, householdUserIds, isServerAdmin);
```

## Recipe Import Pipeline

1. **Client** calls `importRecipe(url)` → adds `pendingRecipeId` to show skeleton
2. **tRPC router** queues job via BullMQ (`server/queue/recipe-import/`)
3. **Worker** parses URL with structured extractors, falls back to AI if enabled
4. **Worker** emits `imported` event via typed emitter → subscription updates cache
5. **Client** removes pending skeleton, adds real recipe

Parsers: `lib/parser/` (structured) → `server/ai/recipe-parser.ts` (AI fallback)

## Real-time & Optimistic Updates

The app uses **subscription-driven cache updates** rather than traditional optimistic updates:

1. **Mutations** trigger server action, add pending state if needed
2. **WebSocket subscriptions** receive events and update React Query cache
3. **Same user** sees update from their own subscription (no optimistic rollback needed)
4. **Other household members** see real-time updates automatically

Pattern in mutation hooks (`hooks/groceries/use-groceries-mutations.ts`):
```typescript
createMutation.mutate(data, {
  onSuccess: (id) => {
    // Update cache immediately for this user
    setGroceriesData((prev) => ({ ...prev, groceries: [newDto, ...prev.groceries] }));
  },
  onError: () => invalidate(), // Revert on error
});
```

Subscriptions (`hooks/groceries/use-groceries-subscription.ts`) handle cross-user sync:
```typescript
useSubscription(trpc.groceries.onCreated.subscriptionOptions(undefined, {
  onData: (payload) => {
    setGroceriesData((prev) => /* merge incoming data */);
  },
}));
```

## Conventions

- Server-only code imports `server-only` package
- Zod schemas for validation (`lib/schema.ts`, `server/db/zodSchemas/`)
- Pino logger: `createLogger("module-name")` for server, `createClientLogger()` for client
- UI components use HeroUI (`@heroui/react`) and Tailwind CSS v4
