# 46 — Sweep leftovers

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13. Absorbs ticket 41.

## What to build

- **Per-image `unoptimized` props.** The global `images: { unoptimized: true }` (`apps/web/next.config.js:62`, ticket 26) already covers these 11 props, so delete them:
  - `step-images.tsx:48,79`
  - `image-gallery-input.tsx:110`
  - `media-gallery-input.tsx:145,171`
  - `readonly-steps-list.tsx:219`
  - `image-lightbox.tsx:187,230`
  - `import-from-image-modal.tsx:231`
  - `media-carousel.tsx:178,324`
- **`ollama-ai-provider-v2` in tsdown's `neverBundle`** (`apps/web/tsdown.config.ts:67`). No package depends on it any more.
- **`lint:fix` still passes `--concurrency=1`** in the root `package.json`. `lint` dropped it in 4803f879.
- **Stale comment** at `packages/auth/src/connection-tests.ts:208`. It says Perplexity is tested with "chat completions", but since ticket 05 it uses the Agent API.
- **Node types set for every workspace** (from 41). `tooling/typescript/base.json:8` sets `types: ["node"]`, so every workspace gets Node's globals whether it uses them or not.
  - Move the setting out of `base.json`. Each workspace that uses Node names it in its own tsconfig. Today these inherit it without saying so: `packages/{api,auth,db,queue,trpc}`, `apps/web/tsconfig.server.json`, and `tooling/{prettier,tailwind}` if they need it.
  - The Next apps keep Node's types anyway, through `next/types/global.d.ts`. The workspaces that actually lose them are `packages/ui` and `packages/i18n`, which use none.
- **Settings TypeScript 6 already applies** (from 41). `esModuleInterop: true` in `base.json:4` and `tsconfig.server.json:9`, and `strict: true`, are no-ops.

## Acceptance criteria

- [x] Each item above is gone.
- [x] `base.json` sets no `types`, and no tsconfig sets an option to its TypeScript 6 default.
- [x] `tsc --showConfig` shows the same effective `strict` and `esModuleInterop` for each workspace as before.
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm build` pass.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — Ticket 41 folded in, with its scope corrected: removing `types` from `base.json` changes almost nothing for the browser code, so it is a leftover, not a ticket of its own.
- 2026-10-14 — Done. The 11 `unoptimized` props are gone (one `<NextImage>` in `media-gallery-input.tsx` now fits on a line), `ollama-ai-provider-v2` left tsdown's `neverBundle` (nothing in the lockfile depends on it), `lint:fix` runs without `--concurrency=1`, and the Perplexity comment says it asks the Agent API one tiny question.
  - **Defaults.** In the installed TypeScript 6.0.3, `strict` unset means on (`getStrictOptionValue`), `esModuleInterop` unset means true, and `types` unset means `[]` (`getAutomaticTypeDirectiveNames`). Removed: `strict: true` and `esModuleInterop: true` from `base.json`, `esModuleInterop: true` from `tsconfig.server.json`, and `types: []` from `tsconfig.sw.json`. Also removed, because they restate TypeScript 6's computed defaults too: `moduleResolution: "Bundler"` (`base.json`, `tsconfig.server.json`, `packages/trpc`; it is the default for module Preserve and ESNext) and `resolveJsonModule: true` (`base.json`; the default under Bundler resolution). `base.json` has a comment saying so. Kept: `strict: false` in `tsconfig.server.json`, and the two `false` values that override `base.json` (`noEmit` in `compiled-package.json`, `incremental` in `tsconfig.server.json`).
  - **Node types.** Named `types: ["node"]` in `apps/web` (`tsconfig.json` and `tsconfig.server.json`), `apps/landing`, `packages/{api,auth,db,queue,trpc}` and `tooling/prettier` (its `index.js` imports `node:url`). The Next apps name it because they run Node code (`server/`, `next.config.ts`) rather than leaning on Next's own type references. Lost Node's types: `packages/ui`, `packages/i18n` and `tooling/tailwind`, which use none.
  - **Check.** Every TypeScript-computed option, plus `strict` and `types`, is the same before and after in each workspace except `types` in those three; the files each program includes are unchanged; and the server bundle tsdown builds from `tsconfig.server.json` is byte-identical. `tsc --showConfig` before was captured at 06349d6c. After, it no longer prints `strict` or `esModuleInterop` (unset, so TypeScript 6's default applies), except `strict: false` in `tsconfig.server.json`:

    | tsconfig                                 | strict before → after | esModuleInterop before → after | types before → after             |
    | ---------------------------------------- | --------------------- | ------------------------------ | -------------------------------- |
    | `apps/landing/tsconfig.json`             | true → true (default) | true → true (default)          | node (base) → node (own)         |
    | `apps/web/tsconfig.json`                 | true → true (default) | true → true (default)          | node (base) → node (own)         |
    | `apps/web/tsconfig.server.json`          | false → false (own)   | true → true (default)          | node (base) → node (own)         |
    | `apps/web/tsconfig.sw.json`              | true → true (default) | true → true (default)          | none (own `[]`) → none (default) |
    | `packages/api/tsconfig.json`             | true → true (default) | true → true (default)          | node (base) → node (own)         |
    | `packages/auth/tsconfig.json`            | true → true (default) | true → true (default)          | node (base) → node (own)         |
    | `packages/config/tsconfig.json`          | true → true (default) | true → true (default)          | node (own) → node (own)          |
    | `packages/db-schema/tsconfig.json`       | true → true (default) | true → true (default)          | node (own) → node (own)          |
    | `packages/db/tsconfig.json`              | true → true (default) | true → true (default)          | node (base) → node (own)         |
    | `packages/i18n/tsconfig.json`            | true → true (default) | true → true (default)          | node (base) → none               |
    | `packages/queue/tsconfig.json`           | true → true (default) | true → true (default)          | node (base) → node (own)         |
    | `packages/shared-react/tsconfig.json`    | true → true (default) | true → true (default)          | node (own) → node (own)          |
    | `packages/shared-server/tsconfig.json`   | true → true (default) | true → true (default)          | node (own) → node (own)          |
    | `packages/shared/tsconfig.json`          | true → true (default) | true → true (default)          | node (own) → node (own)          |
    | `packages/trpc/tsconfig.json`            | true → true (default) | true → true (default)          | node (base) → node (own)         |
    | `packages/ui/tsconfig.json`              | true → true (default) | true → true (default)          | node (base) → none               |
    | `tooling/eslint/tsconfig.json`           | true → true (default) | true → true (default)          | node (own) → node (own)          |
    | `tooling/ingredient-icons/tsconfig.json` | true → true (default) | true → true (default)          | node (own) → node (own)          |
    | `tooling/nutrition/tsconfig.json`        | true → true (default) | true → true (default)          | node (own) → node (own)          |
    | `tooling/prettier/tsconfig.json`         | true → true (default) | true → true (default)          | node (base) → node (own)         |
    | `tooling/tailwind/tsconfig.json`         | true → true (default) | true → true (default)          | node (base) → none               |

  - Left alone: settings that repeat `base.json` rather than a TypeScript default (`module: "Preserve"` in `packages/trpc`; `target`, `skipLibCheck` and `noEmit` in `tsconfig.server.json`).
  - `pnpm lint`, `pnpm typecheck`, `pnpm build` and the `apps/web` unit suite pass.
