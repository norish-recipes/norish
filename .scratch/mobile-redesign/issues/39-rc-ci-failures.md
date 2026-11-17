# 39: rc CI failures (PR #741)

**What to build:** Make PR #741's Quality checks green. See `.scratch/mobile-redesign/spec.md` Part 7 ("Scope and order").

**Blocked by:** none

**Status:** ready

- [x] The recipe-create description moves into the router (`packages/trpc/src/routers/recipes/recipes.ts:206`), where `apps/docs/docs/reference/openapi.json` is generated from; `f96ba0a7e` edited only the JSON. A test proves its claim first: repeating a create with an ID the same user already created returns that recipe's ID. Snapshot regenerated (`pnpm --filter @norish/trpc test published-spec -u`).
- [x] `page-transitions.e2e.ts:389` ("a cookbook slides in from the Library…", `#cookbook-heading` not found, shard 3/4 of run 44078110690) reproduced with `--repeat-each` and its cause fixed. No rerun-until-green.
- [ ] Separate commits on `feat/mobile-redesign`, then into `rc/0.27.0-beta`; PR #741's checks green.

## Comments

- 2026-11-17 (implement): the trpc `test` task now hashes `apps/docs/docs/reference/openapi.json` (`$TURBO_ROOT$` input), so a stale spec fails `pnpm run test` without `--force`. The proof test is a router-through-DB case in `media-after-create.integration.test.ts`; the regenerated snapshot was unchanged (f96ba0a7e already held the text).
- E2E root cause: on each socket recovery the offline warm set reads every library recipe and cookbook in one GET batch. At CI's library size (47 recipes, 8 cookbooks) the URL is about 18.6 KB, so Node answers 431 and every `cookbooks.get` in that batch errors. `useCookbookQuery` then reports any error as "Cookbook not found". Fix: `maxURLLength` (6 000) on the batch link. Reproduced the 431 locally by running the shard-3 sequence on an unfixed build; `:360` alone never grows the library far enough.
- Left: `useCookbookQuery.isNotFound` still treats any error (431, network) as "not found". Not changed, because it is out of this ticket's scope and worth its own call.
