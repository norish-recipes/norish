# SERVER - Backend Core

## OVERVIEW

Node.js backend: tRPC API, auth, database, background workers, AI integration, CalDAV sync.

## STRUCTURE

```
server/
├── ai/           # AI providers, prompts, parsers (gated by isAIEnabled())
├── auth/         # Better Auth config + permission checks
├── caldav/       # CalDAV sync with external calendars
├── db/           # Drizzle schema, repositories, migrations
├── importers/    # Archive importers (Tandoor, Mealie)
├── queue/        # BullMQ workers for background jobs
├── redis/        # Redis pub/sub + connection
├── scheduler/    # Scheduled tasks (cleanup, sync)
├── startup/      # Server initialization sequence
├── trpc/         # tRPC routers, middleware, WebSocket
└── logger.ts     # Pino logger factory
```

## WHERE TO LOOK

| Task               | Location                                  |
| ------------------ | ----------------------------------------- |
| Add API endpoint   | `trpc/routers/<domain>/`                  |
| Add background job | `queue/<job-name>/queue.ts` + `worker.ts` |
| Add DB table       | `db/schema/` + `db/repositories/`         |
| Modify auth        | `auth/auth.ts`                            |
| Add AI feature     | `ai/` (check `isAIEnabled()` first)       |
| Add import format  | `importers/`                              |

## PATTERNS

### tRPC Router Structure

Each domain router in `trpc/routers/<domain>/`:

- `index.ts` - Router export, merges procedures
- `<domain>.ts` - Mutations/queries
- `subscriptions.ts` - WebSocket subscriptions
- `emitter.ts` - Typed event emitter
- `types.ts` - Router-specific types

### Repository Pattern

Routers NEVER query `db` directly. Always use repositories:

```typescript
// WRONG
const result = await db.select().from(recipes);

// CORRECT
import { recipeRepository } from "@/server/db/repositories/recipes";
const result = await recipeRepository.findById(id);
```

### Background Job Pattern

Each job in `queue/<job-name>/`:

- `queue.ts` - Queue + job add functions
- `worker.ts` - Worker with start/stop exports

### Auth Middleware

- `authedProcedure` - Requires authentication
- `serverAdminProcedure` - Requires server admin role
- `permissionMiddleware` - Checks resource permissions

## ANTI-PATTERNS

- Direct `db` queries in tRPC routers
- Skipping `isAIEnabled()` check for AI features
- Using `console.log` instead of Pino logger
- Hardcoding secrets (use `SERVER_CONFIG`)
