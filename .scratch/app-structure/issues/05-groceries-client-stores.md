# 05: Groceries client state in a zustand store

**What to build:** The groceries client state that several components share, today in `GroceriesUiContext` (panel open, `editingGrocery` and the rest) and `StoresContext`'s `storeManagerOpen`, moves into a zustand store in `shared-react/groceries/`. View mode and grouping stay Device Preferences, read through `@norish/shared-react/reader`, not the store. The store resets when the groceries screen unmounts. See `.scratch/app-structure/spec.md`, "State".

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `GroceriesUiContext` is deleted and its consumers read the store with selectors.
- [ ] `storeManagerOpen` lives in the store; toggling it re-renders only what shows it.
- [ ] Leaving and reopening groceries starts with a closed panel and no grocery being edited.
- [ ] A unit test next to the store covers its actions and the reset.
- [ ] The groceries E2E set (spec, "Testing Decisions") passes unchanged.
