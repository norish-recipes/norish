# 04 — The image runs a current Node 22

Status: resolved
Blocked by: None — can start immediately
Target release: 0.25.0-beta (safe fixes only; open question 1 in the spec)

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

The production image is built `FROM node:22-alpine3.21`. That tag was last pushed on 2025-10-30 with Node 22.21.1; docker-node now builds Node 22 only for alpine3.23 and alpine3.24. As a result:

- the image has missed four Node security releases: 22.22.0, 22.22.2, 22.23.0 and 22.23.2;
- the `apk upgrade` in the Dockerfile does not update Node;
- the image runs a different Node from CI, which uses `.nvmrc`'s 22.23.2.

Changes:

- **Base image.** `docker/Dockerfile` moves to **`node:22.23.3-alpine3.24`**, pinned to the exact tag for the release candidate, on both `FROM` lines that use it. `.nvmrc` moves to 22.23.3.
- **Everything that names the Node version agrees with it:**
  - `.devcontainer/default/Dockerfile`;
  - `.github/workflows/_docker-build.yml`;
  - `CONTRIBUTING.md`, which still says 22.22.0.
- **Nothing else changes.** `@types/node` stays where it is; it moves with the runtime major in ticket 15.

**This is the riskiest 0.25 change**, because Alpine moves from 3.21 to 3.24 underneath:

- ffmpeg (video imports);
- the libraries the image installs (`libc6-compat`, `vips-dev`);
- the Python 3.14 install through uv.

Hence the full image smoke test below.

**Fallback.**

- If the smoke test shows an OS-level regression, try `node:22.23.3-alpine3.23`.
- If that regresses too, record why and defer the ticket to 0.26. The cost is that the image keeps missing Node's security releases until then.

**Record, don't change: which libvips sharp loads.**

- sharp 0.35 ships a prebuilt libvips and has no install script.
- The image sets `SHARP_IGNORE_GLOBAL_LIBVIPS=0`, which sharp reads as truthy, so it should be using the prebuilt one.
- Run `node -e "console.log(require('sharp').versions)"` inside the container and record the output in the comments.
- Removing `vips-dev` and the variable, if they are dead weight, belongs to ticket 15.

## Acceptance criteria

- [ ] **Node version.** `docker run … node --version` prints v22.23.3.
- [ ] **Consistency.** `.nvmrc`, the devcontainer, the CI workflows and `CONTRIBUTING.md` name the same version.
- [ ] **Image smoke.**
  - `pnpm docker:build` succeeds and the container starts.
  - `/api/v1/health` is OK.
  - A video import works (ffmpeg, yt-dlp).
  - An image upload works, including HEIC (sharp, heic-convert).
  - A URL import through the parser works (Python).
  - A Norish archive export and import round trip works.
- [ ] **libvips.** The `sharp.versions` output is recorded in the comments.
- [ ] **E2E.** `pnpm test:e2e` passes.
- [ ] **Release notes.** A bullet under `## Fixes and Improvements`: "The Docker image now runs Node.js 22.23 (security fixes)."

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-12 — Narrowed for the safe-fixes-only 0.25: exact tag pinned, the `@types/node` change and the libvips clean-up moved to ticket 15.
- Sources:
  - the Docker Hub tags API for `library/node`;
  - `versions.json` from nodejs/docker-node;
  - `index.json` from nodejs.org/dist.
- 2026-10-13 — Shipped in 0.25.0 (8bf13f1e) as the floating `node:22-alpine3.24`, not the exact pin. The exact pin moves to ticket 16; `CONTRIBUTING.md`'s Node version and the libvips record move to ticket 15.
