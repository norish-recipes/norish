# 15 — Node 26 and undici 8

Status: resolved
Blocked by: 13, 14 (their engine floors are checked against Node 26)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move the runtime to Node 26, and undici to 8 with it.

**Why Node 26.** Node 26 becomes LTS on 2026-10-28 and is supported until 2029-04-30. Node 24 enters maintenance on 2026-10-20, and Node 22 is in maintenance until 2027-04-30. Every target tool accepts 26: ESLint 10 (`>=24`), Vitest 5 (`^22.12.0 || ^24.0.0 || >=26.0.0`), tsdown 0.23 (`^22.18.0 || ^24.11.0 || >=26.0.0`), pnpm 12 (`>=18`), undici 8 (`>=22.19`). The native dependencies (sharp, `@tailwindcss/oxide`, esbuild, msgpackr-extract) are N-API or prebuilt.

**Why undici 8 moves with it.** `packages/shared-server/src/ai/runtime/transport.ts` hands an undici `Agent` to Node's built-in fetch.

- Node's fetch is the undici it bundles: 6.28.1 in Node 22.23.3, 7.x in Node 24, **8.11.2 in Node 26.11**.
- undici 8's dispatcher asserts the v2 handler API (`onRequestStart`; `lib/core/util.js:567-578`). Node 26's fetch speaks it; Node 22's and 24's don't, and every AI call would fail with "invalid onRequestStart method".
- So undici 8 and Node 26 land in the same commit. `transport.ts` is the only direct importer.
- **HTTP/2 is on by default in undici 8** (`allowH2`) for TLS servers that negotiate h2 over ALPN; plain-http LAN providers are unaffected. Keep the default, and note it in the commit.
- Fix the `transport.ts` comment: it says the pin follows "the major Node bundles", which was already wrong on Node 22.

**Changes:**

- **Base image.** `docker/Dockerfile` moves to `node:26-alpine3.24` on both `FROM` lines. Ticket 16 then pins the exact tag.
- **`@types/node` `^26`** in the catalog (`^25.9.5` today). The types follow the runtime major.
- **`undici` `^8`** in `packages/shared-server/package.json`.
- **The libvips clean-up.** Record which libvips sharp loads in the image (`sharp.versions`). If it is sharp's prebuilt one, remove `vips-dev` and `SHARP_IGNORE_GLOBAL_LIBVIPS` from `docker/Dockerfile` as dead weight.
- **Every file that names the Node version:**
  - `.nvmrc`;
  - `.devcontainer/default/Dockerfile` (`javascript-node:…-22-bookworm`);
  - `.github/workflows/_docker-build.yml` and anything else that names the tag;
  - `CONTRIBUTING.md` (it still says 22.22.0);
  - the stack line in `AGENTS.md` ("Node.js 22").
- **Alpine packages.** Re-check ffmpeg, the image libraries and Python on the new base.
- **Engines.** Add `"engines": { "node": ">=26" }` to the root `package.json`, so a source install on an older Node fails early.

**Who is affected.** Installs that run Norish outside Docker need Node 26. → Upgrade note.

## Acceptance criteria

- [x] **Node version.** The image runs Node 26, and CI runs the gates on Node 26.
- [x] **AI transport.** The runtime tests pass, and a real AI call through `createFetchWithTimeout` succeeds on Node 26 (the E2E AI project covers it).
- [x] **Image smoke.** The health check, a video import, an image upload (including HEIC) and a URL import through the parser all work.
- [x] **E2E.** `pnpm test:e2e` passes.
- [x] **Release notes.** An Upgrade note for source installs (Node 26 required).

## Comments

- Filed 2026-10-12 with the spec as "Node 24 LTS".
- 2026-10-13 — The maintainer chose Node 26, as the security plan had. undici 8 moved here from the held lines because it only works with Node 26's bundled fetch. Checked: Node `deps/undici` per line, the undici 8.11.2 tarball (`dispatcher1-wrapper.js`, `migrating-from-v7-to-v8.md`), Docker Hub `node:26-alpine3.24`.
- 2026-10-13 — Code done: `.nvmrc` 26.11.1, `node:26-alpine3.24`, devcontainer `javascript-node:5-26-bookworm`, `@types/node ^26.6.5`, undici ^8.11.2, root `engines.node >=26` with pnpm `engineStrict: true` (a Node 24 install now fails with ERR_PNPM_UNSUPPORTED_ENGINE instead of every AI call failing later), docs and AGENTS/CONTRIBUTING updated, Upgrade note added. Gates green on Node 26.11.1. A real HTTPS fetch through `createFetchWithTimeout` returns 200 on Node 26 and fails with "invalid onRequestStart method" on Node 24, as predicted; the `transport.ts` comment is accurate again. The undici 7.30 left in the lockfile is nested under cheerio and `@ai-sdk/provider-utils` and never meets our dispatcher. **Open:** the image smoke test (health, video, HEIC upload, URL import) and the libvips record, because `docker build` here cannot read Docker Desktop's keychain-backed credentials from a non-interactive session.
- 2026-10-13 — Open items closed. **libvips:** in the 0.26 image on Node 26.11.1, `sharp.versions` lists 29 libraries with vips 8.18.7, which is sharp's prebuilt `@img/sharp-libvips-linuxmusl-*`. Alpine's libvips was never loaded, so `vips-dev`, `SHARP_IGNORE_GLOBAL_LIBVIPS` and the runtime `vips` package are removed (HEIC goes through heic-convert, not libvips). **Image smoke** on the rebuilt image (ticket 16): health, JPEG and HEIC uploads, a URL import through the parser with its video, yt-dlp and ffmpeg all work. `pnpm test:e2e` passes (one load-only flake that passes alone).
- 2026-10-14 — Corrected from the branch review: Vitest 5 and tsdown 0.23 also accept Node 22 and 24 (their ranges are above now). Since ticket 42 the AI transport takes `fetch` from undici itself, so undici's major no longer has to move with Node's.
