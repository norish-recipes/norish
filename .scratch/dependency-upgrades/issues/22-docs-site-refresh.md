# 22 — The docs site refresh

Status: resolved
Blocked by: None — can start immediately
Target release: 0.26.0-beta. The `wrangler` pin is worth doing sooner.

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

`apps/docs` is a Docusaurus site and a standalone pnpm workspace, with its own lockfile.

- **No stable major to take.** Docusaurus 3.10.2 is npm `latest`; 4.0 exists only as canary builds.
- **A refresh within the current ranges** (`pnpm update` inside apps/docs) moves React to 19.3.0, mermaid to 12.1.0 and prettier to 3.9.10. In a scratch run it took the audit from **56 advisories (4 critical, 30 high) to 8**.
- **What remains** needs Docusaurus to update upstream:
  - braces (no fix exists);
  - katex (low);
  - postcss-selector-parser 6;
  - serialize-javascript 6.0.2 (two advisories);
  - tinypool (two advisories);
  - uuid 8.3.2.
- **Where the critical advisories sit.** They are in the dev server (proxy-addr and shell-quote via webpack-dev-server) and in the build-time workers (tinypool). The static site the deploy publishes contains none of them.

**TypeScript in apps/docs** moves from `~5.9.3` to 6.0.3, like the workspace (decided 2026-10-13). TypeScript 6 deprecates `baseUrl`, which `apps/docs/tsconfig.json` uses; check whether Docusaurus' tsconfig preset needs it, and replace it with `paths` if not.

**pnpm in apps/docs.** Its `packageManager` moves to the same pnpm 12 as the workspace (ticket 16).

**Install.** apps/docs is outside the workspace: `pnpm install --ignore-workspace` inside it.

**Pin `wrangler`.** `.github/workflows/docs-deploy.yml` deploys to Cloudflare Pages on pushes to main that touch `apps/docs/**`. It fetches an unpinned `wrangler@4` through `pnpm dlx`, in a job that holds `CLOUDFLARE_API_TOKEN`. Pin an exact version.

## Acceptance criteria

- [x] **Format and build.** `pnpm format` and `pnpm build` in apps/docs pass; the build enforces broken links and anchors.
- [x] **Audit.** The apps/docs audit count is recorded before and after.
- [ ] **Deploy.** `wrangler` is pinned to an exact version, and the deploy workflow is green on its next run.

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - `pnpm outdated` and `pnpm audit` inside apps/docs;
  - a scratch refresh and its audit.
- 2026-10-13 — TypeScript 6 and pnpm 12 decided; HeroUI 3.2.6 and React 19.3 are part of the in-range refresh.
- 2026-10-13 — Done:
  - **Refresh:** `pnpm update` within the current ranges; Docusaurus stays on 3.10.2 (still the latest stable), React and React DOM move to 19.3, Prettier to 3.9.10. HeroUI 3.2.6 and React Aria Components 1.22.1 are pinned to match the web app.
  - **Tooling:** TypeScript 6.0.3 and pnpm 12.11.2. Under pnpm 12, `onlyBuiltDependencies` in `apps/docs/pnpm-workspace.yaml` became `allowBuilds` (the same three packages). Run installs from `apps/docs` without `--ignore-workspace`, as the deploy does; that flag now skips the docs project's own settings.
  - **`baseUrl`:** TypeScript 6 rejects it, and the Docusaurus preset sets it, so `tsconfig.json` unsets it (`null`) and declares the `@site/*` path itself; `pnpm typecheck` passes.
  - **Audit:** 50 advisories (4 critical, 26 high) before, 7 (2 critical, 2 high) after. Left: tinypool ×2 (critical, build-time workers), serialize-javascript ×2, braces (no fix), postcss-selector-parser and uuid, all waiting on Docusaurus.
  - **Format and build:** `pnpm format` passes once trailing whitespace and one table's separator width were fixed in eight pages Prettier 3.9.10 now flags, the 0.25 versioned copies included. `pnpm build` passes, with its broken-link and anchor checks.
  - **wrangler:** pinned to 4.149.0 in the docs deploy and, since its job holds the same token, the landing deploy. 4.150.0 was published the same day, inside pnpm 12's one-day release age.
  - **Not verified:** the deploy workflow's next run.

