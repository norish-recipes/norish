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
- `apps/quick-import-extension` - a git submodule of [Norish-Quick-Import-Extension](https://github.com/AfoxDesignz/Norish-Quick-Import-Extension), checked out here for visibility only. It is not maintained from this repo: it sits outside the pnpm workspace, no gate reaches it, and a change there is a PR to that repository rather than a commit here. Leave it out of repo-wide work such as dependency sweeps.

### The AI boundary

Everything under `packages/shared-server/src/ai/` is AI: `runtime/` (the one
seam that talks to a model — see ADR-0015), `prompts/` (the administrator-editable
prompts and their loader), and `enrichment/` (the features whose input is a stored
recipe and whose output is a domain claim). `shared-server` deliberately holds
these real domain features as well as infrastructure; the `runtime`/`enrichment`
split says which is which. Recipe extraction is not AI code — it is an
import-pipeline feature that happens to use AI and lives with the parser in
`packages/api/src/parser/`. A feature never calls the AI SDK or builds a provider
client; it goes through `ai/runtime/runtime.ts`, naming a prompt and appending
sections (never passing a finished prompt string — ADR-0016).

## Working Conventions

- Keep root scripts and config minimal; workspace ownership should stay inside the owning app, package, or tooling workspace.
- Prefer existing shared abstractions before adding new ones.
- Use `@/` imports where the workspace already supports them.
- Use the existing logger patterns instead of `console.log`.
- Avoid `as any`, `@ts-ignore`, and `@ts-expect-error`.
- Route database access through repositories instead of direct router-level queries.
- Definition of done: the `CONTRIBUTING.md` gates — `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` — plus tests for new functionality. User-visible workflows whose acceptance criteria depend on browser behavior also require passing E2E coverage and follow `docs/agents/feature-docs.md`.
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
