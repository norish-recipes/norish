# 12: The workspace installs isolated, and production runs the source without tsdown

**What to build:**

- A workspace can only import what it declares. An undeclared import fails typecheck or tests, never production.
- Production runs the same source, resolved the same way, as dev and the tests. There is no bundle and no hand-kept list of what stays outside it.
- `pnpm deps:cycles` fails when a package's source imports a devDependency, because the image leaves devDependencies out.
- The image installs the same isolated layout as development.

See `.scratch/architecture-after-upgrades/spec.md`, Installs, the server build and the image.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged. Lands before 07 and 13.

**Status:** ready-for-agent

- [x] `nodeLinker: hoisted` is gone from `pnpm-workspace.yaml`, and nothing brings hoisting back: no `publicHoistPattern`, no `shamefullyHoist`, no hoisted deploy.
- [x] What isolated breaks is fixed. Each fix was verified in a throwaway clone on 2026-10-14:
  - [x] `"preserveSymlinks": true` is deleted from `tooling/typescript/compiled-package.json`. It causes most of the roughly 620 type errors.
  - [x] `getOpenApiDocument()` (`packages/trpc/src/openapi.ts:87`) declares `: ReturnType<typeof generateOpenApiDocument>`, which ends a TS2883 that names `.pnpm/openapi3-ts`.
  - [x] The missing declarations, `catalog:` wherever the catalog has the package:
    - api: `domhandler` (type-only, devDependency), plus `sharp` and `heic-convert` as devDependencies so api's `vi.mock` calls hit the module shared-server loads
    - web: `ai`, `zod`, `sharp`, `@ai-sdk/openai-compatible` and `@ai-sdk/typesafe-ai` as devDependencies, for `__tests__/e2e`
    - shared-server: `drizzle-orm` and `@testcontainers/redis` as devDependencies, and `@ai-sdk/provider` moves to dependencies (`src/ai/runtime/errors.ts:14` imports a value from it)
    - shared-react: `react-dom` and `@testing-library/react` as devDependencies
    - landing: `playwright` and `sharp` as devDependencies (`scripts/capture-shots.mjs`, `scripts/optimize-shots.mjs`)
  - [x] Where they still exist, the `vi.mock("@norish/api")` calls in queue and trpc tests are deleted. Nothing in either package imports api.
  - [x] `packages/db/__tests__/server/db/cleanup/cleanup-workflows.test.ts` and `…/repositories/timer-keywords-config.test.ts` move to `packages/api/__tests__/`. They import db's helpers by relative path, as `startup/backfill-ingredient-aliases.test.ts` does. They now run in api's gate for the first time, and if they have rotted they are fixed here.
  - [x] The `@source` in `apps/web/styles/globals.css:8` points at apps/web's own `node_modules/@heroui/styles/dist`. Check the built CSS once for a class that only HeroUI's dist uses; a wrong path fails silently.
  - [x] `prettier.prettierPath` in `.devcontainer/default/devcontainer.json:80` points at a prettier that is installed under isolated.
- [x] tsdown is gone:
  - [x] `apps/web/tsdown.config.ts`, `apps/web/tsconfig.server.json`, the `build:server` scripts (apps/web, the root, and inside `test:e2e`) and the turbo task are deleted, and `tsdown` leaves apps/web's devDependencies.
  - [x] apps/web's `start` is `node --import tsx server/index.ts`, and tsx moves to apps/web's dependencies. Use `--import tsx`, not the `tsx` CLI, which forks a second process and opens a socket in tmpdir.
  - [x] No `dist-server` reference is left: `.gitignore`, `.dockerignore`, the root and apps/web `turbo.json`, `tooling/eslint/base.ts`, `tooling/monorepo/scripts/check-workspace-imports.mjs`, `apps/web/vitest.config.ts`, `apps/web/__tests__/design-invariants.test.ts`, and the comment at `.github/workflows/_node-ci.yml:110`.
  - [x] The E2E harness (`apps/web/__tests__/e2e/harness/production-stack.ts`) checks for `.next` instead of the bundle, and spawns `node --import tsx server/index.ts` with apps/web as its working directory.
  - [x] AGENTS.md's stack line no longer says "custom Node server bundle via tsdown".
- [x] `tooling/monorepo/scripts/check-workspace-imports.mjs`, which `pnpm deps:cycles` already runs over every package's source, also checks dependencies. (The sweep deleted eslint-plugin-import, so its `no-extraneous-dependencies` rule is not an option.)
  - A value import of a package that the importing workspace lists only under devDependencies, or doesn't list at all, fails the check. `dependencies`, `peerDependencies` and `optionalDependencies` all count.
  - Type-only imports, tests and config files are allowed.
  - In apps/web only `server/**` is held to it, because Next bundles the rest at build time.
  - Whatever it flags is fixed by moving the declaration.
- [x] The image (`docker/Dockerfile`):
  - [x] `pnpm deploy --filter @norish/web --prod` runs isolated, with no linker override.
  - [x] The clean-up after the deploy works inside `.pnpm`, whose folders are named `<name>@<version>[_<peers>]`.
    - It removes the build-time packages that reach the prod closure through peers: TypeScript as tRPC's peer, drizzle-kit as better-auth's optional peer, Babel, `@types`, tailwindcss and `ffmpeg-static`.
    - It keeps the `@norish+*` copies, which are now the code that runs, and the tsx and esbuild the server needs.
    - `rm -rf .pnpm`, the top-level removals and the `@next`/`@swc`/`@img` platform pruning go, because pnpm installs only the build platform's variants.
    - Ticket 13 does the size work.
  - [x] The image copies `apps/web/server/` and `apps/web/package.json` (for its `"type": "module"`), and `CMD` is `node --import tsx /app/apps/web/server/index.ts`.
  - [x] The deploy stays at `/app/node_modules`. Next's links in `.next/node_modules` (pg, pino, sharp) point at `../../../../node_modules/.pnpm/…`, which resolves only from there.
  - [x] No `tsconfig.json` is copied to `/app` or `/app/apps/web`. From there, tsx would apply apps/web's `@norish/queue/*` alias into `/app/packages` and load a second queue registry.
  - [x] The image builds on amd64 and arm64 and boots against Postgres and Redis: health 200, `/login` renders, and the log has no module errors.
- [x] Every `CONTRIBUTING.md` gate passes, plus `pnpm deps:cycles` and `pnpm format:check`. Test counts match before apart from the moved db tests. The E2E suite passes against a fresh `pnpm build`.
- [x] Release notes, under Upgrade notes: "The image starts the server with `node --import tsx /app/apps/web/server/index.ts`. If you override the container's command, update it."

## Comments

- 2026-10-14 (measured in a throwaway clone, before this ticket was written):
  - **Why hoisted existed.** No reason was ever recorded. It arrived in `ad8843fb` with the Expo app, two days after a strict `.npmrc` (`hoist=false`), and mobile has since left the workspace.
  - **What hoisting broke.** #361 (React Native's ws@7 in the deploy) and `e468650b` (archiver 7 at the root, 8 nested: vitest passed and the built server threw).
  - **Isolated with no fixes.**
    - typecheck: about 620 errors in 9 tasks
    - tests: shared-server, shared-react and web fail
    - build: shared, shared-server, trpc and web fail
    - lint, i18n, format and deps:cycles pass
    - install time (6 s) and `node_modules` size (1.3 GB) are unchanged
  - **tsx against the bundle, in the image:**

    |                     | tsx                                                                  | bundle       |
    | ------------------- | -------------------------------------------------------------------- | ------------ |
    | Boot, new container | 8.1 s                                                                | 6.0 s        |
    | Boot, restart       | 5.4 s                                                                | 4.1 s        |
    | Memory after boot   | about 490 MB, plus an esbuild process of about 20 MB after a compile | about 425 MB |
    | Image, compressed   | 405 MB                                                               | 385 MB       |

    A module loaded on demand (video, unit conversion) compiles on first use. The image loads every `@norish` module once, from the deployed copies.

  - **Node 26's own type stripping was rejected.**
    - It refuses files whose real path is under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), and the deployed packages live there.
    - The code would also need 842 relative imports given a `.ts` extension, 13 constructs Node can't strip (parameter properties and one enum), 16 imports marked `type`, and 25 JSON imports given an attribute.
  - **Next's links resolve in an isolated image.** The deploy's `.pnpm` folder names match the build's, because both come from the lockfile. Removing `.next/node_modules` turns every route into a 500.
- 2026-10-14, implemented:
  - **The install.** The lockfile still held five `ai` / `@ai-sdk` entries from the rc merge that were younger than pnpm's 24-hour `minimumReleaseAge`. The maintainer said to force it once: `pnpm install --config.minimum-release-age=0`.
    - The first isolated install left the old hoisted directories in the root `node_modules`, where undeclared imports would still have resolved. Every workspace `node_modules` was deleted and the install run again. The root now holds only `@norish`, `turbo` and `typescript`.
  - **The gates under isolated:**
    - typecheck, lint and test: 46 of 46 tasks, 45 of them freshly run
    - build: passes
    - `format:check`: passes after one `vitest.config.ts` reflow
    - `i18n:check` and `deps:cycles`: pass
    - The two tests moved into api pass there (14 tests); they had never run in a gate before. The db `vitest.config.ts` lost its `@norish/api` and `@norish/queue` aliases, which nothing needs any more.
  - **The `@source` check.** `aria-disabled:opacity-[var(--disabled-opacity)]` appears only in `@heroui/styles/dist`, and the built CSS has it.
  - **The dependency check** (`check-workspace-imports.mjs`) parses imports with the TypeScript compiler API, so type-only clauses, including `import { type A }`, are told apart.
    - It runs over each workspace's `src` (`server/` in apps/web), skipping `__tests__`, `*.test.*`, `*.spec.*`, `*.config.*` and `.d.ts`. `@norish/landing` is skipped as wholly bundled, and so are the workspaces pnpm-workspace.yaml excludes.
    - It flagged only `tooling/eslint` (its configs import `eslint`, a devDependency), so `eslint` moved to dependencies there.
    - With shared-server's `@ai-sdk/provider` put back under devDependencies as a trial, it fails exactly on `src/ai/runtime/errors.ts`.
  - **The harness** waits for `.next/BUILD_ID` and spawns `node --import tsx server/index.ts` from apps/web. The same build's server start was used for the measurements in tickets 06 and 08.
  - **E2E.** The first full run gave 178 passed and 1 failed: after the Redis restart, browser B never showed the grocery browser A added.
    - That was a real race in `useRealtimeSubscription`. A lag invalidated the queries and resubscribed in the same instant, so an event published after the refetch had read, but before the fresh subscription was live on the server, reached neither.
    - The fix is in its own commit, `1462ec82`: the refetch now follows the fresh subscription's Cursor Mark, which the server sends only after registering on the hub. tsx's slower server widened the window enough to show it.
    - After the fix: realtime `--repeat-each 10` gave 90 of 90, twice, and the full suite gave **181 of 181**.
  - **Seen once, not explained.** In a `--repeat-each 3` run before the fix, one server-restart scenario logged "Shutdown step is slow" for "HTTP server close" (1 of 3 repeats). It did not come back in the 180 realtime repeats or the full run after.
- 2026-10-14. **Image verified.** 12's own image (with 07) built on arm64 in 343 s and booted: live in 13 s, ready, `/login` and `/serwist/sw.js` 200, no module errors, migrations ran. The final image (with 13) built and booted the same on arm64 (218 s) and amd64 (456 s under emulation on this Mac).
