# 20 — archiver 8 and dotenv 18

Status: resolved
Blocked by: None — can start immediately
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

- **`archiver` 7.0.1 → 8.0.0 and `@types/archiver` 6.0.4 → 8.0.0.**
  - **API.** archiver 8 is ESM-only with named classes: `new ZipArchive({ zlib: { level: 6 } })`, and `Archiver` becomes a named export. The 8.x types match.
  - **Scope.** Only `packages/shared-server/src/archive/norish-writer.ts` changes; the stream API Norish uses is the same.
  - **Dependencies.** It drops `archiver-utils`, and with it lodash and glob 10, so ticket 03's `lodash` and `brace-expansion@2` floors may become removable.
  - **brace-expansion 5.** archiver 8 pulls in readdir-glob 3 → minimatch 10 → brace-expansion 5. If the audit flags it, add a `brace-expansion@>=5.0.0 <5.0.12` floor.
- **`dotenv` 17.4.2 → 18.0.x.**
  - **Removed:** `.env.vault`, `DOTENV_KEY` and `decrypt()`.
  - **New defaults.** `config()` now reads `DOTENV_OVERRIDE`, `DOTENV_DEBUG`, `DOTENV_ENCODING`, `DOTENV_FAST`, `DOTENV_QUIET` and `DOTENV_PATH` from the environment.
  - **Norish's call.** `config({ path, quiet: true })` in `packages/config/src/env-config-server.ts` is unaffected unless a host sets one of those variables.
  - **Settle time.** 18.x had seven patch releases in three weeks. Take it only once it has gone about two weeks without a patch; otherwise leave dotenv out of this PR.

## Acceptance criteria

- [x] **Archive round trip.** A Norish archive export and import round trip passes, and an archive exported before the bump still imports.
- [x] **Audit.** `pnpm audit` shows no `lodash` or `brace-expansion` findings from archiver. Floors from ticket 03 that are no longer needed are removed.
- [x] **Env loading.** Loading is unchanged: a test with a `.env` file, and one with the variables set in the process environment.
- [x] **Gates.** `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build` pass.

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - the archiver 7.0.1 and 8.0.0 tarballs, and @types/archiver 6.0.4 and 8.0.0;
  - the dotenv 17.4.2 and 18.0.7 tarballs.
- 2026-10-13 — Unchanged; dotenv is now 18.0.7.
- 2026-10-13 — **archiver 8.0.0** with `@types/archiver` 8.0.0: the writer imports `ZipArchive` and builds `new ZipArchive({ zlib: { level: 6 } })`; the stream API it uses is unchanged. The round-trip tests pass, and a new one reads `fixtures/norish-archive-0.25.zip`, written by this writer on archiver 7.0.1 before the bump. archiver 7 stays in the lockfile only under testcontainers (dev). `pnpm audit` has no lodash or brace-expansion finding; this repo had no floors for them to remove. The one high finding left is `braces` through `@next/eslint-plugin-next` (no fixed version; ticket 03).
  - **dotenv stays on 17.** 18.0.7 shipped on 2026-10-09, four days before this work, against the ticket's two quiet weeks. Renovate (ticket 07) can take it once 18 settles; the env-loading tests are for that change.

- 2026-10-14 — Env loading ticked through ticket 45, which took dotenv 18 with the tests.
