# 24: Groceries list

**What to build:** The Groceries tab without drag. See `.scratch/mobile-redesign/spec.md` Part 4 and the Groceries boards (`view`, `overlay`).

**Blocked by:** 23

**Status:** done

- [x] Moved first, in separate commits, any web-only list glue the tab needs (grouping, view mode), with unit tests.
- [x] Store, recipe and grouped views, Unsorted first, Aisle headings, store-coloured checkboxes, prices and sale, empty state.
- [x] Tap the checkbox ticks; a tap on the row opens the edit sheet (store product and price, store, aisle, repeat, Delete/Save); no long-press menu.
- [x] "Add items" accessory and sheet (item, store, repeat with plain-words detection, add another); the Repeat sheet; clear done or the whole list.
- [x] First frame from the Warm Set or a skeleton; writes through the Outbox.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: Moved first (own commits, web switched, tests moved or added): shelf price formatting, line pricing and `useGroceryPrice`, aisle blocks (`placeInAisles`) and recipe grouping, the name/ingredient/aisle hooks of the add and edit panels (`useSettledName` extracted), the repeat pattern edits and `recurrenceTranslationsFrom`, the source breakdown text, and `useGroceryEdit` (web's save/delete branches). Decided: Repeat, Store and Aisle are views inside the add/edit sheet (close goes back) and both sheets use the two detents; Unsorted first and only while it holds a line; the done tail folds per section; the list is flat `DragRow` rows with headings, no drag wired.
- Left out: Pantry switch, Manage stores (gear item and store options), Store Product picker and purchase amount (ticket 26/27), drag (25). The product shows read-only in the edit sheet. Ticket 30: docs for the tab and its gear menu; strings are under `groceries.mobile`.
- Simulator (iPhone 18 Pro, iOS 27.2, light and dark, Metro on :8089, server on :3000 as left running): store view with aisles, prices and sale, by-recipe view, add with "every week" detected and taken, edit sheet saving a store and an aisle (line moved under Dairy & eggs), Repeat view, tick into the done tail; my throwaway line deleted, the view preference put back. Second pass (own server on :3400, throwaway Postgres and Valkey; iPhone 18 Pro, iOS 27.2, dark and light for the first checks): (a) the empty state shows in the by-recipe view of an empty list; the by-store view keeps the Store's section with its aisles. (b) Delete done and Clear list (with its confirm) both work. (c) a milk grouped from a recipe and by hand expands to its two sources; ticking one gives the dash on the group, ticking the group moves it to the done tail; the Store-coloured ring, check and dash are RoundTick's now. (d) With the server stopped after one load: a tick, an add and an edit show at once and survive a kill and relaunch offline; after the server came back the tick and the add were stored, the edit was not (the app went back to the old name). An edit made online saves, so this is the queued-write replay left to the maintainer's pending decision, untouched here; the box stays open for it. (e) A first launch with an empty Warm Set and the server stopped shows the skeleton and keeps it, never the empty state. Seen and left: the empty state's cart icon is near-black on the dark tile.
- 2026-11-15 (fixes): the lost offline edit had two causes. A create shifted its Store's open lines and bumped their versions, so the user's own edit queued after an add was refused as stale; the shift now leaves versions alone (no other repository write bumps a line the caller did not send). And `groceries.update` answered `{ success: true }` before deciding, so the refusal was silent; every versioned grocery write (update, toggle, delete, assignToStore, reorderInStore, markAllDone, deleteDone, and the four repeat edits) now answers `{ success, stale }` once decided and rejects a failure, so Replay parks a refused write as Conflicted. The empty state's black icon came from `useTokenColor` reading `--color-<name>`, which Tailwind inlines away on native: every caller (accent text, nutrition, cooking, shop) got no colour; it reads the scoped `--<name>` now. Simulator (iPhone 18 Pro, iOS 27.2, own server on :3400, throwaway Postgres and Valkey): with the server stopped after one load, a tick, an add to the same Store and a rename of another open line all showed, survived a kill and relaunch offline, and were all stored once the server came back, the new name kept; a rename made offline while the line changed on the server left the server's name and showed "Not saved: it changed elsewhere first" once; the cart icon is the accent green on the dark tile.
- 2026-11-15 (re-review fixes): the skeleton reads "has data" (`isRead`), so an empty list survives a failed refetch; the replay test's fake shifts sort order without versions and decides stale by version; a line another member deleted answers stale to every versioned write and a delete of it is a no-op (another household's line is still refused); work after the commit (pricing, the remembered Store) is logged and never fails a stored write; the app's own grocery writes no longer publish `failed`, so a refused write toasts once (the REST API keeps the event).

### Review log (2026-11-15)

Range `0aeae9448..4bc41b2f2`. Standards on Sonnet low, Spec on Opus medium; fixes `10deff5dd..63759830e`, `818e6c0f6..476ef7e03` (after a diagnosis of the lost offline edit), re-reviewed on Opus medium, then `b68805ca4..93d379f65` and `4bc41b2f2`. The Spec review found the eight moves out of web, the list's ordering and grouping, gestures, Add items, clearing and realtime matching web.

Fixed, first round (8): the empty state on a cold launch with no cache and no server (a skeleton until a read succeeds); the done fold as a heading row for ticket 25; one round tick; one store colour lookup; one amount-and-name piece; the sheet's steps in one map and its choices in their own file, heading rows split by type; one subline per row; the reason on the `eslint-disable` line.

Fixed, second round (3): an offline edit lost after an add in the same Store (the server's create bumped the versions of the lines it shifted; it no longer does, as with planned items); every versioned grocery write answering `stale` once decided, so Replay parks a refused one as Conflicted (ADR-0004) where update and toggle used to answer success; the token colour hook reading `--<name>`, the form the native stylesheet has (since ticket 20's fix round every caller but two had drawn black).

Fixed, third round (6): the skeleton staying after a failed refetch of an empty list; the Replay test's fake following the server's rules; one rule for a line that no longer exists (a versioned write answers stale, its delete is a no-op) with the public REST endpoints keeping their 404; follow-up work after the commit never failing a stored write; one toast for a failed live write.

Rejected (5): the `useCallback`s already in web's `use-product-choice.ts` (not new or moved code); a `string | null` choice id; two commit subjects over 70 characters; a partly stale batch going to Conflicted as a whole (ADR-0004's stated consequence); the sort-order tie after an offline reorder that followed another member's add.

For ticket 27: the edit sheet's product row is blank after choosing a Store that holds none of the user's lines, until saved (web looks the Store's product up with `useProductLink`).

Seen on the simulator against an own server: the empty state, Delete done, Clear list, a grouped line expanded and ticked, a tick, an add and an edit made offline surviving a relaunch and stored on return, the conflict case telling the user once, a first launch without server or cache keeping the skeleton.

Final state `4bc41b2f2`: all 11 gates exit 0, mobile lint without warnings.
