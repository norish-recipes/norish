# 43 — Docker image without leftovers

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 16. Found in the branch review on 2026-10-13.

## What to build

`docker/Dockerfile`:

- **`rm -rf .pnpm` after `pnpm deploy` (`:123`).**
  - The deploy writes a virtual store of about 880 MB despite `nodeLinker: hoisted`, and this line deletes it again.
  - Find out why the deploy writes it, so the deploy writes only what the image ships. Start by trying `--config.node-linker=hoisted` on the deploy and reading pnpm 12's `deploy` docs.
  - If pnpm can't, report it upstream with a repro.
- **A native toolchain nothing uses.** The deps stage installs `python3 make g++ pkgconfig libpq-dev` (`:39`), another stage installs `pkgconfig libpq-dev` (`:83`), and the runtime installs `libpq` (`:204`).
  - The lockfile has no node-gyp, pg-native or libpq.
  - The packages that could compile (cpu-features, ssh2, msgpackr-extract) are denied in `allowBuilds`.
  - Remove all three installs. This is the same case as the libvips removal (46ba3a36).
- **Stale comment (`:94-97`).** It says `injectWorkspacePackages` is enabled, but nothing sets it. The second install is still needed, because it recreates the `packages/*/node_modules` that aren't copied from the deps stage. Say that instead.

## Acceptance criteria

- [x] The image builds and the image smoke test passes.
- [x] The image is no larger than before.
- [ ] The Dockerfile has no `rm -rf .pnpm`, no compiler toolchain and no libpq.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 (implemented) — The native toolchain is gone from all three stages (`python3 make g++ pkgconfig libpq-dev` in deps, `pkgconfig libpq-dev` in build, `libpq` at runtime), and the stale `injectWorkspacePackages` comment now says what the second install is for. **`rm -rf .pnpm` stays:** pnpm 12.11.2 cannot deploy without it (below), so the last criterion is left unticked.
  - **Why the deploy writes `.pnpm`.** It is not a leftover setting: `pnpm deploy` always writes a project virtual store into the target's `node_modules/.pnpm` (a full copy of every package, laid out `@/<name>/<version>/<hash>/node_modules/<name>`), then copies every package again into the hoisted tree. A plain `pnpm install` with `nodeLinker: hoisted` writes only `lock.yaml` there, and pnpm's own changelog says hoisted "writes no virtual store at all". `--config.node-linker=hoisted`, `--config.virtual-store-type=global` and an absolute `--config.virtual-store-dir` all leave it in place. The deployed `pnpm-workspace.yaml` records `virtualStoreType: project` but no `nodeLinker`.
  - **Repro** (pnpm 12.11.2, macOS and the Alpine build stage): a workspace with `packages: [app]` and `nodeLinker: hoisted`, `app` depending on `is-odd@3.0.1`. `pnpm install` leaves `node_modules/.pnpm/lock.yaml` only; `pnpm deploy --filter app --prod out` leaves `out/node_modules/.pnpm/@/is-odd/3.0.1/<hash>/…` and `@/is-number/6.0.0/<hash>/…` beside the hoisted `out/node_modules/is-odd` and `is-number`. For Norish the copy is 856 MB.
  - **Upstream:** not filed yet. Draft title: "`pnpm deploy` writes a project virtual store into the target's `node_modules/.pnpm` under `nodeLinker: hoisted`", with the repro above. **For the maintainer:** file it from your account, or say so and I will with `gh issue create -R pnpm/pnpm`.
  - **Image.** Built twice from clean `git archive` copies (HEAD before the change, then HEAD plus the new Dockerfile; both with `PNPM_CONFIG_MINIMUM_RELEASE_AGE=0` added to the copy only, because today's lockfile is younger than pnpm 12's release age): 1,772,508,706 bytes before, 1,771,882,995 after (`docker image inspect`), the difference being libpq. Both images hold the same 534 package versions under `/app/node_modules`.
  - **Smoke** on the new image with Postgres 17, Redis 8.10.1 and Obscura (`compose -p norish-smoke43`): `/api/v1/health` 200 with db, redis and parser ok; sign-up; a JPEG upload and a HEIC upload through `recipes.uploadImage` (the HEIC bytes are converted and stored as JPEG); a URL import of a BBC Good Food recipe through the parser, which also downloaded the page's video with yt-dlp 2026.08.19 and ffmpeg 8.1.2; a Job Scheduler run fired (see ticket 18); `docker compose stop` shut the server down in 0.3 s.
- 2026-10-14 (review fixes) — pnpm 12.11.2 is still npm `latest`, so `rm -rf .pnpm` stays until the upstream issue above is filed and fixed. Filing it needs the maintainer's go-ahead.
- 2026-10-14 (after the plan was done): the upstream report no longer needs filing. `.scratch/architecture-after-upgrades/` ticket 12 moves the workspace and the image to pnpm's isolated linker. Under isolated, the deploy's `node_modules/.pnpm` is the real store that every top-level entry links into, so `rm -rf .pnpm` goes and there is no second copy to delete.
