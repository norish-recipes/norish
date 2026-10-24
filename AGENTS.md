# Norish Agent Guide

Use this file for lightweight repo context.

## Product

- Norish is a household-first recipe app for planning meals, sharing groceries, and cooking together.
- Main domains are recipes, groceries, meal planning, household collaboration, auth, imports, and AI-assisted parsing.

## Stack

- Node.js 26 + TypeScript
- pnpm workspaces + Turborepo
- `apps/web`: Next.js 16 App Router, React 19, HeroUI v3 (`@heroui/react`), Tailwind CSS v4, Motion, TanStack Query, custom Node server run from source through tsx
- `apps/mobile`: Expo SDK 56, Expo Router, React Native 0.85, React 19, HeroUI Native v1 (`heroui-native`), Uniwind, Tailwind CSS v4 theme tokens, TanStack Query
- tRPC, PostgreSQL + Drizzle, Valkey + BullMQ, Better Auth

This Next.js has breaking changes from your training data: read the relevant guide in `apps/web/node_modules/next/dist/docs/` before writing Next code. Landing sets `agentRules: false`, so `next dev` writes no app-level AGENTS.md.

## Repo Shape

- `apps/web` - web app and its custom server, run from source through tsx
- `apps/mobile` - Expo app, **parked pending a rewrite** and outside the pnpm workspace: install it on its own with `pnpm --dir apps/mobile install --ignore-workspace`, then `pnpm dev:mobile` starts it. No root gate reaches it, and it is expected to break at compile and runtime against the current release
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
prompts and their loader), `enrichment/` (the features whose input is a stored
recipe and whose output is a domain claim), and `resolution/` (the features whose
input is a name and whose output is which catalogue entry it is — ADR-0037). `shared-server` deliberately holds
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
- Definition of done: the `CONTRIBUTING.md` gates — `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` — plus tests for new functionality. User-visible workflows whose acceptance criteria depend on browser behavior also require passing E2E coverage and follow `docs/agents/feature-docs.md`.
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

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
