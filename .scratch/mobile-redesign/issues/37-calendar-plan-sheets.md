# 37: Calendar plan sheets

**What to build:** A drafted planned-item sheet and one move UI. See `.scratch/mobile-redesign/spec.md` Part 6 ("Calendar").

**Blocked by:** 34

**Status:** done

- [x] The planned-item sheet is a draft: date, slot and note commit on Save; Cancel or swipe down discards (unit test for the draft).
- [x] Remove asks to confirm, then the item animates out of the timeline.
- [x] One move UI, the plan sheet's 14-day strip plus its date picker, then the slot tabs, shared by Move from Today and the planned-item sheet; Calendar's Add uses the same strip. The day-cards list stays only for planning a recipe from the recipe.
- [x] Motion: day cards' items animate in, out and on move.
- [x] Maestro: edit a planned item's date and slot, Save, see it moved.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Save is one write: `calendar.editItem` ({itemId, version, title?, date?, slot?}) checks the version once, writes text, day and slot in one transaction (`editPlannedItem`; a new slot puts it last there) with one bump, and publishes one event (`itemMoved` when it moved, else `itemUpdated`). The repository locks the row it reads (`for update`), so a second write at the same version waits and then writes nothing. `saveItem` sends it with one optimistic write, shared with `moveItem`; offline it is one Outbox entry, replayed or parked Conflicted as a whole. `moveItem` shares the repository writer, the router's version check and the move event; `calendar.updateItem` is gone, and web's note panel saves through the same draft and `saveItem` (a moved note now lands last in its new slot). `date` and `targetDate` take a `YYYY-MM-DD` key.
- The draft tracks touched fields: an untouched one follows the live item, Save sends only touched fields that differ, at the live version, once. A blank note disables Save; the Save that wrote closes the sheet, once.
- One move UI is `MoveFields` (`DayStrip` plus `SlotTabs`, both on date keys), used by the planned-item sheet, the Move sheet (`/move`) and Plan a recipe; `usePlannedItemSheet` wires both sheets. The day-cards sheet is recipe-only.
- The Remove confirm is shared (`useConfirmRemovePlanned`), titled plain "Remove". `useFreshRows` hands back `settled` with its `epoch`, so the Calendar's growth neither fades rows in nor springs layout.
- Maestro on the iPhone 17: `planned-item-edit` 3/3 (server state via `/planned`, tomorrow's key from `/day`), `plan-from-today` 1/1.
- Seen on the iPhone 17 against a local server: text, day and slot saved as one `editItem` call; a server-side edit with the sheet open and untouched showed the new text and slot with Save disabled; with the note touched and the item moved server-side, Save stored only the note and kept the new day; offline, a text and day edit replayed as one `editItem` on reconnect and the item ended with both. Not seen: the removed row's own exit, swipe-down discard, haptics.

### Review log (2026-11-17)

Range `be521cb7f..d41bc0a42`. Treated as complex (it changes how planned items are written, online and through the Outbox): Standards on Sonnet low, Spec on Opus high; implemented on Sonnet medium, both fix rounds on Opus medium; reviewed twice.

Fixed, first review (10): a save that changed text and day went out as two writes, the second at a guessed version, so a housemate's write in between or an app kill could store half of it or land the move on their change; now one `calendar.editItem` write (one version check, one transaction, one Outbox entry). The draft compared a frozen copy with the live item, so a housemate's change enabled Save and wrote the old values back; it now tracks touched fields and sends only those. Dates in the Maestro harness through the date helpers; `plannedWhere` failing loudly; the strip's days as date keys in lib/; tests mocking through the package entry with shared mocks; one planned-item sheet hook; the settled span on `useFreshRows`' epoch; one chip size.

Fixed, second review (9): a refused edit or move still committing its renumbering of the other items in both slots (the row is locked when read and a refused write rolls back; a database test with two concurrent requests failed 3 of 3 before); a double tap on Save going back twice; `calendar.editItem` on the late-delivery list; `calendar.updateItem` deleted, with web's note panel on the one save; one optimistic write for moves and edits; one `PlannedItemEdit` type from the contract; one load-and-check step; dates validated as date keys; the harness rejecting a malformed offset.

Rejected (1): splitting what `use-planned-item-sheet` returns; returning the sheet's three pieces together is the save-and-close helper the first review asked for.

Changed on web: the note panel saves text and move as one write and sends only what changed; a moved note lands last in its new slot (it was first).

Closed after checking: the app's minimum server version stays 0.27.0 (no released server lacks `editItem`; against a self-built one Save rolls back with the notice and is not queued); Hidden Items do not apply to the calendar; an edit that changes text and day reaches other members as one `itemMoved` carrying the item.

Not seen on the simulator: swipe-down discard, the removed row's own exit (behind the closing sheet), the widgets updating on a device, haptics. `1c2529abb` does not pass trpc's tests alone (fixed in `ae3f3c846`).

Final state `d41bc0a42`: all 11 gates exit 0, mobile lint has no warnings; the concurrency test passed 3 of 3.
