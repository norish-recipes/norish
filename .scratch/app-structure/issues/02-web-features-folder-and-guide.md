# 02: Web features folder, lint rule and the architecture guide

**What to build:** Web gets `features/` next to `app/`, with the same one-way import rule mobile has: shared folders, then features, then routes, and no feature reaching into another; another feature's panels are opened through its `index.ts`, which exports nothing else. The architecture is written down where contributors look: an "App architecture" section in CONTRIBUTING.md after "Project Structure", one line of why per rule, and a one-line pointer in AGENTS.md. Mobile's catch-up spec stops saying web keeps its layout. See `.scratch/app-structure/spec.md`, "Features", "Web layout" and "Docs".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `apps/web/features/` exists and the `@/features/*` path resolves.
- [ ] A `no-restricted-imports` override in `apps/web/eslint.config.ts` blocks `@/features/<x>/**` everywhere outside feature `<x>` except `app/` route files, and leaves `@/features/<x>` importable, the same patterns as mobile's rule.
- [ ] CONTRIBUTING.md "App architecture" covers: features by domain with routes composing them; no feature reaching into another, with a feature's `index.ts` exporting only the panels other features open; what goes in a feature versus the shared folders; server data through plain hooks over the Query cache; zustand for shared client state, `useState` for the rest; shared-react by feature with one tRPC context, one platform adapter, and cross-cutting `trpc`, `platform`, `offline`, `config`, `reader`. One line of why per rule.
- [ ] "Project Structure" in CONTRIBUTING.md shows `features/` for web and mobile, and its shared-react line no longer says "hooks and contexts".
- [ ] AGENTS.md points to the section in one line.
- [ ] `.scratch/mobile-catch-up/spec.md`'s "Web keeps its current layout" points to this spec.
