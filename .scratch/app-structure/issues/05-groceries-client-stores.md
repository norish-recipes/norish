# 05: Groceries client state in a zustand store

**What to build:** The groceries client state that several components share, today in `GroceriesUiContext` (panel open, `editingGrocery` and the rest) and `StoresContext`'s `storeManagerOpen`, moves into a zustand store in `shared-react/groceries/`. View mode and grouping stay Device Preferences, read through `@norish/shared-react/reader`, not the store. The store resets when the groceries screen unmounts. See `.scratch/app-structure/spec.md`, "State".

**Blocked by:** 04

**Status:** done

Done at 1c849f172, in two steps: the store (645dc9aa6) and the screen reading it (1c849f172). `useGroceriesUiStore` holds `addGroceryPanelOpen`, `editingGroceryId` and `storeManagerOpen`, a setter for each and `reset`; the context's recurrence panel fields had no reader and are gone. `GroceriesScreen` resets the store as it unmounts. Each panel sits in a small wrapper that selects whether it is open, so the page no longer renders when one opens. The edit wrapper reads its grocery live through `useGroceryFor(id)` and renders nothing once it is gone, and its recurring row through `useRecurringGroceryFor`, a `select` that replaced `getRecurringGroceryForGrocery`. zustand joined the catalog for web and shared-react. Mobile's smoke screen shows no panels, so it needs none of this. Before it, two follow-ups from 04's review: config reads stop refetching on every mount (a652068c2, since replaced by the `config` broadcast in 8f244aa7a), and the screen holds the Pantry's reads without rendering for them (cfaac83ce, now `PantryReads`). Renders (mounts / updates / commits, two identical runs): check 0 / 268 / 7, add 19 / 1,530 / 12, edit panel 178 / 221 / 8, echo 0 / 227 / 2, view mode 853 / 700 / 10. The groceries E2E set passed twice over (`--repeat-each=2`, 274 of 274).

- [x] `GroceriesUiContext` is deleted and its consumers read the store with selectors.
- [x] `storeManagerOpen` lives in the store; toggling it re-renders only what shows it.
- [x] Leaving and reopening groceries starts with a closed panel and no grocery being edited.
- [x] A unit test next to the store covers its actions and the reset.
- [x] The groceries E2E set (spec, "Testing Decisions") passes unchanged.

Review fixes (2c787bc34..f33f55800): the store holds the edited grocery's id, not a copy; an admin config edit is broadcast and `useConfigSubscription` keeps the config reads current; a failed write rolls back from `useMutation`'s own `onMutate`/`onError`, overlapping failures included; the aisles subscription watches the list's foods without rendering the screen. Renders after them: check 0 / 268 / 7, add 19 / 1,529 / 13, edit panel 178 / 221 / 8, echo 0 / 227 / 2, view mode 853 / 700 / 10. E2E now runs once, after the whole ticket set.
