# 04: Groceries data as plain hooks

**What to build:** Groceries, stores and pantry data move into `shared-react/groceries/` as plain hooks over the Query cache. `GroceriesContext` and `StoresContext` (shared factories and web bindings) are deleted; components read only the hooks they need, using `select` where they need a slice. The groceries, stores and pantry subscriptions mount once in the groceries feature root. The error adapter comes from the platform adapter. Mobile's smoke screen uses the same hooks. See `.scratch/app-structure/spec.md`, "State" and "shared-react".

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] `@norish/shared-react/groceries` exports the groceries, stores, aisles, prices and pantry queries, mutations and subscriptions as plain hooks.
- [ ] The groceries, stores and pantry hook factories and context factories are deleted, with web's `hooks/groceries`, `hooks/stores`, `hooks/pantry` bindings, `app/(app)/groceries/context.tsx`'s data context and `stores-context.tsx`'s data part.
- [ ] Mobile's `src/hooks/groceries` binding is deleted and the smoke screen imports from `@norish/shared-react/groceries`.
- [ ] No shared-react groceries file imports another shared-react feature.
- [ ] The `store-prices-pending`, `store-aisles` and `pantry` suites sit next to the code and run against the plain hooks.
- [ ] The groceries, pantry, aisles, prices and versions E2E specs pass unchanged, checked with repeated runs.
