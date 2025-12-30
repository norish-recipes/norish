# PROJECT KNOWLEDGE BASE

**Generated:** 2025-12-30

## OVERVIEW

Real-time recipe sharing app. Next.js 16 (App Router) + custom Node server with tRPC WebSocket, BullMQ workers, Better Auth, Drizzle ORM (PostgreSQL), Redis pub/sub.

## STRUCTURE

```
norish/
├── server/           # Backend: tRPC, auth, DB, queue workers, AI, CalDAV
├── app/(app)/        # Authenticated pages (recipes, groceries, calendar, settings)
├── app/(auth)/       # Login/auth pages
├── hooks/            # React hooks by domain (recipes/, groceries/, etc.)
├── components/       # UI components (HeroUI + Tailwind v4)
├── context/          # React contexts (household, permissions, user)
├── lib/              # Shared utilities (client + server)
├── config/           # Server config loading (env-config-server.ts is server-only)
├── types/dto/        # Shared TypeScript DTOs
├── tooling/          # ESLint, Vitest configs (re-exported from root)
├── __tests__/        # Tests mirror source structure
└── server.ts         # Entry: migrations → seed → video init → caldav → workers → HTTP
```

## WHERE TO LOOK

| Task               | Location                        | Notes                                   |
| ------------------ | ------------------------------- | --------------------------------------- |
| Add tRPC endpoint  | `server/trpc/routers/<domain>/` | Merge into `router.ts`                  |
| Add React hook     | `hooks/<domain>/`               | Follow `use-{domain}-{type}.ts` pattern |
| Add background job | `server/queue/<job-name>/`      | Need queue.ts + worker.ts               |
| Add DB table       | `server/db/schema/`             | Then repository in `repositories/`      |
| Add page           | `app/(app)/<path>/`             | Next.js App Router conventions          |
| Modify auth        | `server/auth/auth.ts`           | Better Auth with encrypted email        |
| AI features        | `server/ai/`                    | Gated by `isAIEnabled()`                |
| CalDAV sync        | `server/caldav/`                | Event listener + sync logic             |

## COMMANDS

```bash
pnpm dev              # tsx watch server.ts | pino-pretty
pnpm build            # next build + tsdown + update-sw
pnpm start            # node dist-server/server.cjs
pnpm test             # vitest watch
pnpm test:run         # vitest single run
pnpm db:push          # drizzle-kit push
pnpm lint:fix         # eslint --fix
```

## CONVENTIONS

- **Import paths**: Always `@/` alias (maps to project root)
- **Server-only code**: Import `server-only` package
- **tRPC procedures**: Use `authedProcedure` for auth, `serverAdminProcedure` for admin
- **DB access**: Always through repositories (`server/db/repositories/`), never direct `db` queries in routers
- **Real-time updates**: Use typed emitters from `server/trpc/emitter.ts`
- **Logging**: `createLogger("module-name")` server, `createClientLogger()` client
- **UI components**: HeroUI (`@heroui/react`) + Tailwind CSS v4 + Motion
- **Unused vars**: Prefix with `_` (e.g., `_unusedVar`)

## ANTI-PATTERNS (THIS PROJECT)

- **Direct DB in routers**: Always use repositories layer
- **NextAuth patterns**: This uses Better Auth, not NextAuth
- **Type suppression**: Never `as any`, `@ts-ignore`, `@ts-expect-error`
- **console.log**: Use Pino logger (`createLogger`)
- **Optimistic updates**: Use subscription-driven cache updates instead

## UNIQUE STYLES

- **Real-time pattern**: Mutations trigger server → WebSocket subscriptions update React Query cache → all household members sync automatically
- **Permission model**: Three-tier (everyone/household/owner) per action (view/edit/delete)
- **Recipe import pipeline**: URL → BullMQ job → Parser (structured or AI fallback) → emit event → subscription updates UI
- **Tooling location**: All configs in `tooling/`, root files re-export

## CI/CD

- **Trigger**: PRs to main, pushes to any branch
- **Pipeline**: install → build → (tests, lint, format:check) parallel
- **Node**: 22.21.1, pnpm 10.26.0

## KEY DEPENDENCIES

| Package           | Purpose                       |
| ----------------- | ----------------------------- |
| `better-auth`     | Auth (SSO/OIDC/OAuth2)        |
| `drizzle-orm`     | PostgreSQL ORM                |
| `bullmq`          | Background job queue          |
| `ioredis`         | Redis client                  |
| `@trpc/*`         | API layer with WebSocket      |
| `@heroui/react`   | UI components                 |
| `playwright-core` | Web scraping (rebrowser fork) |
| `yt-dlp-wrap`     | Video downloading             |

## NOTES

- First user becomes Server Owner + Admin, registration auto-disabled after
- Auth provider changes require server restart
- AI features slow with OpenAI API - results may vary
- CalDAV sync only tested with Radicale
- Zustand mostly unused - prefer React Query + context
