# 44 — wrangler as a locked devDependency

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 22. Found in the branch review on 2026-10-13.

## What to build

`docs-deploy.yml:57` and `landing-deploy.yml:49` run `pnpm dlx wrangler@4.149.0`.

- The version lives in a `run:` string, outside every lockfile and without an integrity hash, so CI downloads whatever the registry serves under that version.
- `pnpm outdated` and `pnpm audit` can't see it, and neither could Renovate without a regex manager. The workflow comments say Renovate bumps it; nothing does (ticket 07 is wontfix).

**The fix:**

1. Make wrangler a devDependency of `apps/docs` (which has its own lockfile) and of `apps/landing`.
2. Run it with `pnpm exec wrangler`.
3. Delete the comments that say Renovate bumps the pin.

## Acceptance criteria

- [x] Both workflows run `pnpm exec wrangler`, and wrangler's version is recorded in a lockfile.
- [ ] A deploy run, or a `wrangler --version` step in CI, passes.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — Reason reworded now that ticket 07 is wontfix: the case is the lockfile and integrity hash, not Renovate.
- 2026-10-14 (implemented) — wrangler 4.150.0 is a devDependency of `apps/landing` (root lockfile) and `apps/docs` (its own lockfile), pinned exactly like the release the workflows named before. 4.150.0 rather than 4.151.0: the newest that clears pnpm 12's one-day release age before CI's frozen install unblocks. Both workflows `pnpm exec wrangler pages deploy` from the app's directory, and the Renovate comments are gone.
  - Both install roots deny wrangler's install scripts in `allowBuilds`: `workerd` (it only checks its platform binary, and a Pages deploy of static files never starts workerd) and, in `apps/docs`, `esbuild` (the root already allows it). A frozen install fails on any unlisted build script under pnpm 12.
  - wrangler brings `supports-color@10`, which moves the optional-peer suffix of `debug`'s dependents in both lockfiles (no version changes) and gives the landing app its own resolution of eslint. Landing lint and typecheck pass, and the docs site builds (`pnpm build` in `apps/docs`, EXIT=0).
  - `pnpm exec wrangler --version` prints 4.150.0 in both apps here. The CI half of the second criterion is the first deploy after the merge; it is left unticked until then.
- 2026-10-14 (review fixes) — `_node-ci.yml` runs `pnpm --filter @norish/landing exec wrangler --version` after the build (4.150.0 here), so the box ticks on the branch's first CI run instead of the first deploy. apps/docs keeps its own lockfile outside PR CI; its deploy proves its copy.
