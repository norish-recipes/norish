# 27: Stores management and prices

**What to build:** Manage stores, the store editor and Store Products. See `.scratch/mobile-redesign/spec.md` Part 4 ("Stores") and the `stores`, `storeEdit`, `deleteStore`, `storeMenu` and `product` overlays.

**Blocked by:** 25

**Status:** open

- [x] Add, edit (name, colour, website / Search Address), delete Stores; reorder Stores and each Store's Aisles by drag.
- [x] Store Product search and choice from the edit sheet, with price.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: moved first to shared-react (web switched, tests moved): the store editor (`EditingStore`, `canSaveStore`, link fields, aisle draft helpers, `useSaveStore` with its shop check, `SHOP_CHECK_MESSAGES`) and the product field (`useProductField`, `useProductChoice`, product rows); web had no Store or Aisle reorder plan to move (it holds ids in drag order), so mobile's `movedAfter` resolves a drop by id against the Stores as they are when the row lands. The edit sheet holds the choice and Save commits it; the product step has search, known and shop rows, Unlink and "Type the price yourself" (price and currency only; name, pack, page and purchase amount stay on web, the boards draw none).
- Manage stores is one sheet whose editor replaces the list; deleting asks with a native alert (Cancel / Move items to Unsorted / Delete items, counted from the list), so the board's radio dialog became alert buttons. The editor is one drag list (fields as header, Aisles as rows, add field as footer); `DragGrip` is now shared with the recipe editor.
- Simulator (iPhone 18 Pro, iOS 27.2, own server :3400, throwaway Postgres and Valkey, light; dark on the list): add a Store with colour and link (shop check line), edit, reorder Stores (list followed), reorder Aisles (list followed), delete a Store with lines (moved to Unsorted), product pick and typed price (line and Store total 2 × 0.89), a Store with none of the user's lines filled the product row before Save. Offline: add, delete, edit, reorder and a typed product price survived relaunch and were stored on return. Not seen: the shop's live search (no network to a real shop; only manual Store Products were seeded, so "From the shop" rows, nothing-found and no-answer states were never drawn); a reorder followed by an edit of the same Store offline is refused on replay (versions bumped, no prediction by design); an offline product choice prices only once the server answers (no optimistic price).
- Metro under `CI=1` serves a stale bundle (no watching); run it without.

