# Norish Agent Guide

Use this file for lightweight repo context.

## Product

- Norish is a household-first recipe app for planning meals, sharing groceries, and cooking together.
- Main domains are recipes, groceries, meal planning, household collaboration, auth, imports, and AI-assisted parsing.

## Stack

- Node.js 22 + TypeScript
- pnpm workspaces + Turborepo
- `apps/web`: Next.js 16 App Router, React 19, HeroUI v3 (`@heroui/react`), Tailwind CSS v4, Motion, TanStack Query, custom Node server bundle via tsdown
- `apps/mobile`: Expo SDK 55, Expo Router, React Native 0.83, React 19, HeroUI Native v1 RC3 (`heroui-native`), Uniwind, Tailwind CSS v4 theme tokens, TanStack Query
- tRPC, PostgreSQL + Drizzle, Redis + BullMQ, Better Auth

## Repo Shape

- `apps/web` - web app and server bundle entry
- `apps/mobile` - Expo app
- `packages/api` - server domain logic
- `packages/trpc` - tRPC routers and API surface
- `packages/db` - schema and repositories
- `packages/shared-react` - shared hooks and contexts
- `packages/shared`, `packages/shared-server`, `packages/ui`, `packages/config`, `packages/i18n`, `packages/auth`, `packages/queue` - shared package layer
- `tooling/` - shared lint, format, TypeScript, Tailwind, GitHub, and monorepo tooling

## Working Conventions

- Keep root scripts and config minimal; workspace ownership should stay inside the owning app, package, or tooling workspace.
- Prefer existing shared abstractions before adding new ones.
- Use `@/` imports where the workspace already supports them.
- Use the existing logger patterns instead of `console.log`.
- Avoid `as any`, `@ts-ignore`, and `@ts-expect-error`.
- Route database access through repositories instead of direct router-level queries.
- Definition of done: the `CONTRIBUTING.md` gates — `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` — plus tests for new functionality; user-visible work also follows `docs/agents/feature-docs.md`.
- Keep repo guidance concise; prefer practical conventions over long project narratives.

## Agent skills

### Issue tracker

Working tickets and specs live as committed markdown under `.scratch/<feature>/`, so they need no tracker account and travel with the branch; GitHub Issues is the community inbox and Linear (`GEZ`) the maintainer backlog, both read-only to the skills. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

One glossary at root `CONTEXT.md` (a `###` section per feature area); ADRs in per-area folders under `docs/adr/` with globally unique numbering. See `docs/agents/domain.md`.

### Feature docs & release notes

Every feature PR updates the Target Version's release notes and the docs in `apps/docs` (pages with screenshots; env vars land in `.env.example`, a configuration page, and Upgrade notes). See `docs/agents/feature-docs.md`.
