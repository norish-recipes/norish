# 08: Architecture page in the docs

**What to build:** A "Architecture" page in the docs' Development section (`apps/docs/docs/development/architecture.md`, after setup) that explains Norish at a high level to a new contributor. It covers:
- **Folder structure:** the apps, packages and tooling, and what each owns.
- **What goes where:**
  - an app feature versus the app's shared folders
  - the shared-react features versus its cross-cutting folders
  - `@norish/shared` contracts
  - server logic in `packages/api` versus the tRPC routers versus repositories
  - the AI boundary
- **The decisions:** one line each, linking the ADR where one exists. For example:
  - the Query cache is the one source of truth
  - realtime is idempotent merges
  - zustand is for client state only
  - no feature imports another
- **How data flows:** a read, a write and a realtime update, from a component through `useTRPC`, the Query cache, the tRPC link (and the Outbox while Offline), the router, `packages/api` and the repository to Postgres, and back through the realtime hub into the cache. One Mermaid diagram per flow at most; the docs site renders Mermaid.

It describes the shape as it stands when it ships, with one line naming the features not migrated yet; that line goes with the last feature. CONTRIBUTING.md's "App architecture" rules from 02 link to the page instead of repeating it. Plain and short, per the docs' minimal style; run `/unslop` on it. See `.scratch/app-structure/spec.md`, "Docs".

**Blocked by:** 02, 06

**Status:** done

- [x] The page exists in the Development section and builds in the docs site.
- [x] It covers folder structure, what goes where, the decisions and the three data flows.
- [x] Every decision with an ADR links it; nothing restates an ADR at length.
- [x] Folder and file names in it match the repo at the time it ships.
- [x] CONTRIBUTING.md and AGENTS.md link to it.
- [x] Examples are English.
