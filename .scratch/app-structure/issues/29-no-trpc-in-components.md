# 29: No tRPC in components

**What to build:** Every `useTRPC` call left in either app moves into a named hook in shared-react, in the domain it reads, and lint keeps it that way. After this ticket the whole E2E suite runs. Nothing visible changes. See `.scratch/app-structure/spec.md`, the rule against calling tRPC from a component under "State".

**Blocked by:** 25, 26, 27, 28

**Status:** ready-for-agent

- [ ] Each remaining `useTRPC` and `useTRPCClient` call in web moves into a shared-react hook of the domain it reads:
  - groceries: the list and Pantry screens, the delete-store modal, `use-ingredient-for`, the store products' query and mutations;
  - recipes: the nutrition card, the worked-out nutrition, the share panel and the public share config;
  - offline: the offline recipe and cookbook pages, the offline status modal and the offline cache controller;
  - shared hooks: `use-recipe-prefetch` and `use-back-destination`.
- [ ] The same goes for mobile's smoke screen, its i18n context and its offline engine.
- [ ] Where a caller needs only a cache key or a prefetch, a shared-react helper builds it. Whatever can't move is named in the lint rule's exceptions, with one line of why.
- [ ] Both apps' ESLint configs ban importing `useTRPC` and `useTRPCClient` from `@norish/shared-react/trpc` outside those exceptions.
- [ ] Moved tests run against the hooks in their new homes.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, with no retries.

## Comments
