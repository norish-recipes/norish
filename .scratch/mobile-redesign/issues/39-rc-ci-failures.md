# 39: rc CI failures (PR #741)

**What to build:** Make PR #741's Quality checks green. See `.scratch/mobile-redesign/spec.md` Part 7 ("Scope and order").

**Blocked by:** none

**Status:** ready

- [ ] The recipe-create description moves into the router (`packages/trpc/src/routers/recipes/recipes.ts:206`), where `apps/docs/docs/reference/openapi.json` is generated from; `f96ba0a7e` edited only the JSON. A test proves its claim first: repeating a create with an ID the same user already created returns that recipe's ID. Snapshot regenerated (`pnpm --filter @norish/trpc test published-spec -u`).
- [ ] `page-transitions.e2e.ts:389` ("a cookbook slides in from the Library…", `#cookbook-heading` not found, shard 3/4 of run 44078110690) reproduced with `--repeat-each` and its cause fixed. No rerun-until-green.
- [ ] Separate commits on `feat/mobile-redesign`, then into `rc/0.27.0-beta`; PR #741's checks green.
