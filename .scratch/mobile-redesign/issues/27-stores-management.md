# 27: Stores management and prices

**What to build:** Manage stores, the store editor and Store Products. See `.scratch/mobile-redesign/spec.md` Part 4 ("Stores") and the `stores`, `storeEdit`, `deleteStore`, `storeMenu` and `product` overlays.

**Blocked by:** 25

**Status:** done

- [x] Add, edit (name, colour, website / Search Address), delete Stores; reorder Stores and each Store's Aisles by drag.
- [x] Store Product search and choice from the edit sheet, with price.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: moved first to shared-react (web switched, tests moved): the store editor (`EditingStore`, `canSaveStore`, link fields, aisle draft helpers, `useSaveStore` with its shop check, `SHOP_CHECK_MESSAGES`) and the product field (`useProductField`, `useProductChoice`, product rows); web had no Store or Aisle reorder plan to move (it holds ids in drag order), so mobile's `movedAfter` resolves a drop by id against the Stores as they are when the row lands. The edit sheet holds the choice and Save commits it; the product step has search, known and shop rows, Unlink and "Type the price yourself" (price and currency only; name, pack, page and purchase amount stay on web, the boards draw none).
- Manage stores is one sheet whose editor replaces the list; deleting asks with a native alert (Cancel / Move items to Unsorted / Delete items, counted from the list), so the board's radio dialog became alert buttons. The editor is one drag list (fields as header, Aisles as rows, add field as footer); `DragGrip` is now shared with the recipe editor.
- Simulator (iPhone 18 Pro, iOS 27.2, own server :3400, throwaway Postgres and Valkey, light; dark on the list): add a Store with colour and link (shop check line), edit, reorder Stores (list followed), reorder Aisles (list followed), delete a Store with lines (moved to Unsorted), product pick and typed price (line and Store total 2 × 0.89), a Store with none of the user's lines filled the product row before Save. Offline: add, delete, edit, reorder and a typed product price survived relaunch and were stored on return. Not seen: the shop's live search (no network to a real shop; only manual Store Products were seeded, so "From the shop" rows, nothing-found and no-answer states were never drawn); a reorder followed by an edit of the same Store offline is refused on replay (versions bumped, no prediction by design); an offline product choice prices only once the server answers (no optimistic price).
- Metro under `CI=1` serves a stale bundle (no watching); run it without.

- 2026-11-15 (review fixes): a Store or Aisle reorder renumbers without bumping versions; `stores.update`, `delete` and `reorder` answer `{ success, stale }` once decided (a missing Store: update stale, delete a no-op; a delete that kept the Store for lines it was not shown is stale) and reject a failure, so Replay parks a refused write as Conflicted; the cache predicts the Store's bump on an edit and an Aisle's only on a rename, and rereads on a stale answer. A Store's delete takes its lines off the list at once (or to Unsorted, version +1) and puts both back on a failure; a product choice prices the line at once from a typed price or a known product, kept when Queued, put back and toasted when refused. The product field composes `useProductSearch` and `useTypedProduct`; one `HintButton` serves every info icon; the colour picker and Aisle list have their own files; the focused-field hook is shared and scrolls a list too. Board: the `storeMenu` overlay draws only Mark all done, Delete done and Clear all, so the menu stays as it is.
- Simulator (iPhone 18 Pro, iOS 27.2, own server :3400, throwaway Postgres and Valkey): offline reorder, rename, reorder, relaunch: on return order and name stored, nothing stale. A Store renamed on the server meanwhile: the server's name stood, "Not saved: it changed elsewhere first" once. Offline typed price 0.89: line and Store total at once and after a relaunch, stored on return. Offline delete with "Delete items": lines gone at once and after a relaunch, Store and lines gone on the server. The add-aisle field on a 12-Aisle Store first stayed under the actions (the form sheet measures from its own top, and its padding animates without a layout event); fixed and seen above the actions, also after adding one. Seen, not changed: a write queued behind a Conflicted entry for the same Store (here a delete after the refused rename) is parked as a dependency and never sent, while the list already shows it done until a reread.
- 2026-11-15 (re-review fixes): an entry Parked as Conflicted seeds no dependencies in Replay (any procedure), and a write a stored Outbox already parked behind one is released on the next pass, so a Store's reorder, delete, grocery writes and product choices after a refused rename are sent and decided on their own; a parked create still parks what references it. The Stores replay test now queues through the real Outbox link and covers an Aisle add and a Store created, edited and reordered offline. A stale Store delete rereads the groceries too; a delete that moves lines to Unsorted publishes them as a grocery `updated` event.

### Review log (2026-11-15)

Range `da33165f8..5fb71464b` (`e31fe35f8` in it fixes two lint warnings from ticket 21). Standards on Sonnet low, Spec on Opus medium; fixes `697b21f4f..5b5a6ddbe` on Opus medium (server-side versions), re-reviewed on Opus medium, second round `604833225..5fb71464b`. The Spec review found the moves out of web, drag and product choice clean.

Fixed, first round (9): the user's own offline Store writes making each other stale and nobody being told (a reorder leaves Store and Aisle versions alone; every versioned stores write answers `stale` once decided; the cache follows the versions the server bumps); an offline product choice without a price; "Delete items" leaving its lines under Unsorted; the add-aisle field under the keyboard; comments, the autofocus disable's reason, the product field hook split in two, the store editor's colours and aisles in their own files, one hint button for every info icon.

Fixed, second round (3): a Conflicted entry parking every later write that names its entity (it now parks none, for every procedure; the dependency rule stays for parked creates); a stale Store delete not rereading the groceries; "Move items" publishing no grocery events to other members.

Settled by the board: the store heading's menu has Mark all done, Delete done and Clear all only; Manage stores is in the gear menu.

Kept after checking: `movedAfter` beside `resolveDrop` (an id in the current list against an index in the rows shown).

Rejected (3): the Maestro "manage a Store" flow here (ticket 30); the Search Address check bumping a Store's version unannounced (the event it publishes corrects the client); commit subjects.

Board deviations for the maintainer: the Store delete asks with a native alert where the board draws radios; a product typed by hand takes price and currency on mobile, its other fields stay on web.

Open for ticket 30's device run: the shop's live product search (the throwaway server had hand-seeded products only).

Final state `5fb71464b`: all 11 gates exit 0; lint warnings at or under the baseline in every package, mobile at zero.
