# 13: The image ships only what runs

**What to build:**

- An operator downloads about 30% less per release: about 275 MB, against 388 MB in 0.25.
- Nothing in the image is there only for the build.
- The standalone output stays only if it earns its place.

See `.scratch/architecture-after-upgrades/spec.md`, Installs, the server build and the image.

**Blocked by:** 12. The cuts are measured against its isolated, tsdown-free image.

**Status:** ready-for-agent

- [x] Where a package is in the image only because of a wrong declaration, the declaration is fixed and no `rm` line is needed:
  - [x] apps/web's client-only libraries move to devDependencies, because Next bundles them into `.next`:
    - `@dnd-kit/*`, `@fontsource-variable/*`, `@heroicons/react`, `@heroui/react`, `@heroui/styles`, `@iconify/react`, `@internationalized/date`
    - `@norish/shared-react`, `@norish/ui`, `@tanstack/*`, `@trpc/client`, `@trpc/tanstack-react-query`
    - `embla-carousel(-react)`, `motion`, `next-themes`, `react-aria-components`, `react-markdown`, `tailwind-merge`, `use-sound`, `usehooks-ts`, `vaul`, `zustand`

    Check each against Next's `*.nft.json` traces first. Anything a trace lists, or `serverExternalPackages` names, stays a dependency, and so does anything `server/**` imports (ticket 12's import check).

  - [x] `pino-pretty` stays a dependency (maintainer's call).
  - [x] `ffmpeg-static` is a devDependency of packages/api (changed 2026-10-15, see Comments): the image neither downloads nor ships it, and production uses Alpine's ffmpeg.
- [x] The deploy step removes what the server never loads. Each cut was verified on a repack of 12's image on 2026-10-14; sizes are compressed / unpacked:

  | Cut                                                                                                                                                                                                                                                                                                                               | Saves                                     |
  | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
  | `*.map` in `node_modules` (Next alone has 100 MB)                                                                                                                                                                                                                                                                                 | 31 / 138 MB                               |
  | `@next+swc-*` (only `next build` uses it)                                                                                                                                                                                                                                                                                         | 30 / 86 MB                                |
  | Store folders still unreachable after the declaration fixes: filled optional peers (drizzle-kit's esbuild 0.18 and 0.25 with their natives, its tsx, brocli; `@playwright/test` and `playwright`) and the archiver closure that is bundled into `.next`. `readdir-glob` is traced and stays, and so does the tsx the server runs. | 30 / 184 MB (the whole unreachable group) |
  | next's `dist/esm`, `dist/docs` and `*.runtime.dev.js`                                                                                                                                                                                                                                                                             | 5 / 23 MB                                 |
  | `*.d.ts`, `*.d.mts`, `*.d.cts`                                                                                                                                                                                                                                                                                                    | 4 / 33 MB                                 |
  | `*.md`                                                                                                                                                                                                                                                                                                                            | 2 / 9 MB                                  |
  | `dist`, `__tests__` and config files in the deployed `@norish` copies                                                                                                                                                                                                                                                             | 1 / 9 MB                                  |

- [x] After `uv sync`, Python's unused parts go: `libpython3.15.so*` (nothing links it), tcl/tk, tkinter, idlelib, turtledemo, ensurepip, the base pip, `include` and `share`. Saves 16 / 47 MB. The parser starts and reports ok.
- [x] The image holds one copy of the workspace code. `/app/packages/<pkg>` keeps `package.json` and a `src` link into the deployed copy. Saves 8 / 31 MB.
  - Data reads (`resolveExistingWorkspacePath`) still find the prompts, `retired-defaults.json`, `publish.lua`, `source-table.json`, the icon set and the migrations.
  - Migrations run on boot.
- [x] The standalone trial (moved here from 07):
  - [x] Build without `output: "standalone"`, and have the image copy the built output minus its cache. Keep it only if the image builds and boots and is smaller or faster to build. Otherwise revert to standalone.
  - [x] Decide here whether production reads Next's config from `.next/required-server-files.json` instead of running `next.config.js` at boot. In `http-server.ts`, before `next()`: `process.env.__NEXT_PRIVATE_STANDALONE_CONFIG ??= JSON.stringify(JSON.parse(readFileSync(join(WEB_APP_DIR, ".next", "required-server-files.json"), "utf8")).config)`.
    - Gain: 23 / 34 MB (next-intl's plugin, serwist, glob and two `@swc/core` builds no longer ship), and the config loads in 2 ms instead of 260 ms.
    - Cost: a private variable, the one Next's own standalone server sets.
  - [x] Record next trimmed to its trace as a further lead: 21.6 of next's 63.2 MB kept, compressed size not measured.
- [x] The image builds on amd64 and arm64 and boots against Postgres and Redis: health 200, `/login` renders, `/serwist/sw.js` 200, and the log has no module errors. It is about 275 MB compressed or less; the verified repack was 274.9 MB / 1.07 GB, against 405.5 MB / 1.87 GB for 12's image. Record the before and after sizes and the build time here.
- [ ] The maintainer's pre-release test includes a URL import, a video import, an image upload including HEIC, and an AI job. The store-folder cut rests on static analysis and Next's traces, and the boot check reaches none of those paths.
- [x] Release notes, under Fixes and Improvements: "The Docker image is about 30% smaller to download."

## Comments

- 2026-10-14. The breakdown of 12's image (405.5 MB compressed / 1.46 GB in layers):

  | Layer           | Compressed | Unpacked |
  | --------------- | ---------- | -------- |
  | node 26         | 64 MB      | 180 MB   |
  | apk ffmpeg      | 48 MB      | 109 MB   |
  | `node_modules`  | 183 MB     | 889 MB   |
  | `.uv/python`    | 32 MB      | 97 MB    |
  | yt-dlp          | 39 MB      | 40 MB    |
  | parser venv     | 11 MB      | 36 MB    |
  | `/app/packages` | 9 MB       | 45 MB    |
  | `.next`         | 12 MB      | 48 MB    |

- **Not pursued, with their numbers:**
  - **yt-dlp:** a 39 MB binary carrying its own Python. A venv on the shipped Python 3.15 could replace it, but a `curl_cffi` wheel for cp315 on musl is doubtful.
  - **Minimal ffmpeg:** most of its 48 / 109 MB is codecs Norish never uses (it uses libx264, aac, stream copy and ffprobe), but trimming means building ffmpeg ourselves.
  - **A hand-built base:** alpine plus the node binary saves 7 MB but gives up free base-image updates.
- 2026-10-14. **Implemented** on `chore/dependency-upgrades`. Sizes are compressed (gzip, as a registry stores the layers) / unpacked (the sum of the layer tars), measured the same way for every image here, arm64:

  | Image                                                               | Compressed | Unpacked |
  | ------------------------------------------------------------------- | ---------- | -------- |
  | Before: 12's image plus 07 (`d0aaffb5`)                             | 409.1 MB   | 1.27 GB  |
  | The cuts and the one copy, still standalone and running next.config | 283.8 MB   | 0.75 GB  |
  | Plus Next's config read from `required-server-files.json`           | 261.6 MB   | 0.72 GB  |
  | **After**, plus no standalone output (what is committed)            | 260.6 MB   | 0.72 GB  |

  36% less to download. Idle memory after boot: 456 MiB before, 438 MiB with the config read from JSON. The image build step (`pnpm run build` and its cleanup) took 88.6 s without standalone against 101.7 s with it; whole builds are not comparable, because BuildKit's layer cache differed between them (343 s for the before image from cold, 134 s for the after image with the deps stage cached).

  - **Declarations.** Next's `*.nft.json` traces name only `next`, `react` and `react-dom` among apps/web's dependencies, no `serverExternalPackages` entry is a web dependency, and `server/**` imports only `@norish/*`, so the 29 client-only libraries are devDependencies. With the config decision below, `@serwist/turbopack`, `next-intl` and `serwist` are too, since only `next.config.js` loaded them at run time. `pino-pretty` stays in shared-server and `ffmpeg-static` in api, its folder still removed by name.
  - **Store folders by reachability, not by name.** `docker/prune-deploy.mjs` walks the deploy from its top-level links through dependencies, optional dependencies and required peers, never optional peers, and removes every store folder it does not reach. On this lockfile it removes 41: exactly the ticket's list (drizzle-kit's esbuild 0.18 and 0.25 with their natives, its tsx 4.23.12 and brocli, `@playwright/test`, `playwright`) plus what only the by-name cuts needed (Babel's helpers, `babel-plugin-react-compiler`, ffmpeg-static's download closure, `@types/node`'s `undici-types`). A list of versioned names would go stale with every upgrade; the walk cannot remove a folder that something still reaches. **The archiver closure stays:** shared-server declares it, so the walk reaches it, and cutting it would rest on the export route being its only importer (true today: `norish-export.ts` is imported by `app/(app)/export/recipes/route.ts` alone). It is under 1 MB.
  - **One copy of the workspace code.** `/app/packages/<dir>` holds `package.json` and a `src` link into the package's own store folder (`@norish+<name>@file+…`). Verified in the image: the 17 prompts, `retired-defaults.json`, `publish.lua`, `source-table.json`, the icon set's manifest and the migrations journal resolve, and migrations run on boot. `shared-react` and `ui` no longer ship at all, being devDependencies now. The deployed copies lose `dist` (declarations only), `__tests__` and the build configs.
  - **Python.** The parser starts and reports ok (`/api/v1/health/ready` shows `parser: ok`, recipe-scrapers 15.12.0).
  - **Standalone dropped.** Without it the image copies `.next` less its caches, type output, source maps and trace files: 1 MB smaller and the build step about 3 s shorter, and it boots the same. Next writes `required-server-files.json` either way.
  - **Config from `required-server-files.json`: adopted**, through `__NEXT_PRIVATE_STANDALONE_CONFIG` as the ticket proposed, set before `next()` in production only (dev still runs `next.config.js`). Next logs "Running next.config took 1.8ms" in the image. The custom server's public `conf` option was tried after review and is not enough: Next 16.4 loads the config more than once, and only the first load takes `conf`. With `conf` and no `next.config.js`, `/_next/image` answered 400 (the optimizer running on Next's defaults); with the variable it answers 404, as `images.unoptimized` makes it. The variable's failure mode is silent, though: if a Next release stopped reading it, the image (which holds no `next.config.js`) would start on Next's defaults without a word. `packages/api/__tests__/startup/next-standalone-config.test.ts` checks that Next's config loader still reads it, so that upgrade fails the test gate instead.
  - **Lead, not pursued:** next trimmed to its trace keeps 21.6 of next's 63.2 MB unpacked; compressed size not measured.
  - **Further lead:** the image build spends about 10 s writing Turbopack's filesystem cache, which the image then deletes.
  - **Boot check, arm64** (fresh Postgres 17 and Redis 8.10.1): live in 12 to 15 s, ready 200, `/login` 200, `/serwist/sw.js` 200, no module errors; the container stays healthy with Redis stopped while ready answers 503.
  - **Still open:** the amd64 build and boot, and the maintainer's pre-release test (a URL import, a video import, a HEIC upload and an AI job).

- 2026-10-14. **Final image, both architectures** (HEAD after review): arm64 260.9 MB / 0.72 GB, amd64 259.5 MB / 0.74 GB, against 409.1 MB / 1.27 GB before. Both boot against Postgres 17 and Redis: live, ready, `/login`, `/serwist/sw.js` and the manifest 200, `/_next/image` 404 (the built config is the one running), the data files resolve, migrations run, no module errors, healthy with Redis stopped. Build time 218 s arm64, 456 s amd64 under emulation. Still open: the maintainer's pre-release test.
- 2026-10-15, from the branch review (the maintainer's calls):
  - **No prune script.** The maintainer wants the Dockerfile complete on its own, so `docker/prune-deploy.mjs` is gone and its walk runs as a `node` heredoc in the Dockerfile. The store's contents are the same, and with the walk doing the work, drizzle-kit is no longer removed by name. Naming the leftovers in the `rm` list instead would have kept 30.5 MB the walk removes.
  - **`ffmpeg-static` is a devDependency.** The maintainer wants it out of the production image. The image build no longer downloads it either. `yt-dlp.ts` finds Alpine's ffmpeg on `PATH` before trying ffmpeg-static, so the image still converts video. The criterion above about keeping it a dependency no longer holds. The import check reads only `import` and `export`, never `require()`, so it doesn't flag the fallback; that reason never held.
  - **Still open:** `react-aria` sits in apps/web's `dependencies` since `3ef31c03`, which needs it for `UNSAFE_PortalProvider`. Every other client library is a devDependency; moving it too is the maintainer's call.
