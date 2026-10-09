# 19: Seed and backfill mint through the resolver

**What to build:** The rules for minting and folding also exist, as separate copies, in the startup backfill and the Open Food Facts seed. Those copies are in `packages/api/src/startup/backfill-ingredient-aliases.ts`, `packages/db/src/repositories/{ingredient-backfill,ingredient-seed}.ts` and `packages/shared-server/src/ingredients/seed/catalogue-seed.ts`. They include "oldest keeps the spelling" and "the fold is JS, so not SQL". They sit outside the "one module that mints" claim in `resolver.ts`'s header. The proposal is a resolver-owned bulk interface (e.g. `mintKnown(aliases[])`) that the seed and backfill go through.

**Blocked by:** 15

**Status:** needs-triage

- [ ] Decide whether ADR-0037/ADR-0038 accept these as one-off paths (neither says so today); if so, close this ticket with that reason.
- [ ] Otherwise: seed and backfill mint through the resolver, and no fold call remains in `backfill-ingredient-aliases.ts` or `catalogue-seed.ts` (the two repository files already have none).
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- From the 2026-09-30 architecture review, rated Speculative.
