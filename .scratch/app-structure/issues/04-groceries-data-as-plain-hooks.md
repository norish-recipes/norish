# 04: Groceries data as plain hooks

**What to build:** Groceries, stores and pantry data move into `shared-react/groceries/` as plain hooks over the Query cache. `GroceriesContext` and `StoresContext` (shared factories and web bindings) are deleted; components read only the hooks they need, using `select` where they need a slice. The groceries and stores subscriptions mount once in the groceries feature root; the pantry subscription stays in the shell, since a recipe page or a dashboard card changes the Pantry while the groceries screen isn't mounted. The error adapter comes from the platform adapter. Mobile's smoke screen uses the same hooks. See `.scratch/app-structure/spec.md`, "State" and "shared-react".

**Blocked by:** 01, 03

**Status:** done

Done at e7d81d0d0, in four steps: Pantry (344435606), stores, prices and aisles (06a7d293a), the list (fb2b80894), and the form state and recurrence detection, which only the grocery panels use (daa7e60cc). `storeManagerOpen` joined `GroceriesUiContext`, so `stores-context.tsx` is gone and 05 moves both. Web's hook tests for the list and stores hooks tested shared-react code, so they moved with the three suites. The screen root reads the list, stores, prices and aisles as the providers did, so neither view comes back to a cache emptied while the other showed. A row reads its own link through `useLinkFor`, a `select` on the prices; the Store check on an aisle moved into `useStoreAisles`, and asking again for a food new to the list moved into the aisles subscription. The groceries E2E set passed twice over (`--repeat-each=2`, 272 of 272).

- [x] `@norish/shared-react/groceries` exports the groceries, stores, aisles, prices and pantry queries, mutations and subscriptions as plain hooks.
- [x] The groceries, stores and pantry hook factories and context factories are deleted, with web's `hooks/groceries`, `hooks/stores`, `hooks/pantry` bindings, `app/(app)/groceries/context.tsx`'s data context and `stores-context.tsx`'s data part.
- [x] Mobile's `src/hooks/groceries` binding is deleted and the smoke screen imports from `@norish/shared-react/groceries`.
- [x] No shared-react groceries file imports another shared-react feature.
- [x] The `store-prices-pending`, `store-aisles` and `pantry` suites sit next to the code, run against the plain hooks and pass lint, which skipped them under `__tests__/`.
- [x] The groceries E2E set (spec, "Testing Decisions") passes unchanged, checked with repeated runs; `offline` and `realtime` matter most here, since the subscription and the optimistic writes move.
