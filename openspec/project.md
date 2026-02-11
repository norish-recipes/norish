# Project Context

## Purpose

Norish is a real-time recipe sharing application designed for household collaboration. It enables users to manage recipes, grocery lists, meal planning calendars, and video content with live synchronization across household members. The app supports recipe importing from URLs, AI-powered parsing, CalDAV calendar integration, and multi-provider authentication.

## Tech Stack

### Core

- **Runtime:** Node.js 22.x with TypeScript 5.9
- **Framework:** Next.js 16 (App Router) with custom Node server
- **Package Manager:** pnpm 10.x

### Frontend

- **React:** 19.x with React Query (TanStack Query)
- **UI Components:** HeroUI (`@heroui/react`) + Tailwind CSS v4
- **Animation:** Motion (Framer Motion)
- **Internationalization:** next-intl

### Backend

- **API Layer:** tRPC with WebSocket subscriptions
- **Database:** PostgreSQL with Drizzle ORM
- **Cache/Pub-Sub:** Redis with ioredis
- **Queue:** BullMQ for background jobs
- **Authentication:** Better Auth (SSO/OIDC/OAuth2)

### AI Integration

- **SDK:** Vercel AI SDK with multi-provider support
- **Providers:** OpenAI, Anthropic, Google, Azure, Groq, Mistral, Ollama, DeepSeek, Perplexity

### Tooling

- **Build:** tsdown (server), Next.js (client)
- **Testing:** Vitest with React Testing Library
- **Linting:** ESLint 9 (flat config) with Prettier
- **Scraping:** Playwright (rebrowser fork), yt-dlp

## Project Conventions

### Code Style

- **Import paths:** Always use `@/` alias (maps to project root)
- **Unused variables:** Prefix with `_` (e.g., `_unusedVar`)
- **Logging:** Use `createLogger("module-name")` on server, `createClientLogger()` on client
- **No console.log:** Use Pino logger instead
- **No type suppression:** Never use `as any`, `@ts-ignore`, or `@ts-expect-error`
- **Import order:** Types first, then builtin, external, internal, parent, sibling, index
- **JSX props:** Sorted alphabetically with callbacks last, shorthand first

### Architecture Patterns

- **Repository pattern:** All database access through `server/db/repositories/`, never direct queries in routers
- **tRPC procedures:** Use `authedProcedure` for authenticated routes, `serverAdminProcedure` for admin
- **Server-only code:** Import `server-only` package to prevent client bundling
- **Real-time pattern:** Mutations trigger server events => WebSocket subscriptions update React Query cache => all household members sync automatically
- **Optimistic updates:** Used alongside subscription-driven cache updates for responsive UX

### File Organization

| Task           | Location                        | Pattern                            |
| -------------- | ------------------------------- | ---------------------------------- |
| tRPC endpoint  | `server/trpc/routers/<domain>/` | Merge into `router.ts`             |
| React hook     | `hooks/<domain>/`               | `use-{domain}-{type}.ts`           |
| Background job | `server/queue/<job-name>/`      | `queue.ts` + `worker.ts`           |
| DB table       | `server/db/schema/`             | Then repository in `repositories/` |
| Page           | `app/(app)/<path>/`             | Next.js App Router conventions     |

### Testing Strategy

- **Framework:** Vitest with jsdom environment (default)
- **Server tests:** Add `// @vitest-environment node` comment at top of file
- **Setup:** Configured in `tooling/vitest/setup.ts`
- **Coverage:** V8 provider with text, JSON, and HTML reporters
- **Commands:** `pnpm test` (watch), `pnpm test:run` (single run)

### Git Workflow

- **CI Trigger:** PRs to main, pushes to any branch
- **Pipeline:** install => build => (tests, lint, format:check) in parallel
- **Quality gates:** All checks must pass before merge

## Domain Context

### User Model

- First registered user becomes Server Owner + Server Admin
- Registration auto-disables after first user (invite-only thereafter)
- Auth provider changes require server restart

### Permission Model

- Three-tier permissions: everyone / household / owner
- Per-action granularity: view / edit / delete
- Household-scoped data isolation

### Recipe Import Pipeline

1. URL submitted => BullMQ job created
2. Parser attempts structured extraction (JSON-LD, microdata)
3. Falls back to AI parsing if structured fails
4. Emits event on completion => subscription updates UI

### CalDAV Integration

- Bidirectional sync for meal planning
- Event listener pattern for changes
- Tested with Radicale server

## Important Constraints

- **AI features:** Gated by `isAIEnabled()` check; can be slow with external APIs
- **Video processing:** Requires yt-dlp and ffmpeg binaries
- **Browser automation:** Uses rebrowser-playwright-core to avoid detection
- **React Query preferred:** Zustand is present but mostly unused

## External Dependencies

| Service      | Purpose                    | Notes                          |
| ------------ | -------------------------- | ------------------------------ |
| PostgreSQL   | Primary database           | Required                       |
| Redis        | Cache, pub/sub, job queue  | Required                       |
| AI Providers | Recipe parsing, assistance | Optional, multiple supported   |
| CalDAV       | Calendar sync              | Optional, tested with Radicale |
| OAuth/OIDC   | SSO authentication         | Optional, configurable         |
