# 37: Calendar plan sheets

**What to build:** A drafted planned-item sheet and one move UI. See `.scratch/mobile-redesign/spec.md` Part 6 ("Calendar").

**Blocked by:** 34

**Status:** open

- [x] The planned-item sheet is a draft: date, slot and note commit on Save; Cancel or swipe down discards (unit test for the draft).
- [x] Remove asks to confirm, then the item animates out of the timeline.
- [x] One move UI, the plan sheet's 14-day strip plus its date picker, then the slot tabs, shared by Move from Today and the planned-item sheet; Calendar's Add uses the same strip. The day-cards list stays only for planning a recipe from the recipe.
- [x] Motion: day cards' items animate in, out and on move.
- [x] Maestro: edit a planned item's date and slot, Save, see it moved.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Save is one write: `calendar.editItem` ({itemId, version, title?, date?, slot?}) checks the version once, writes text, day and slot in one transaction (`editPlannedItem`; a new slot puts it last there) with one bump, and publishes one event (`itemMoved` when it moved, else `itemUpdated`). `saveItem` sends it with one optimistic write; offline it is one Outbox entry, replayed or parked Conflicted as a whole. `updateItem` is a thin call of the same logic; `moveItem` shares the repository writer and the move event.
- The draft tracks touched fields: an untouched one follows the live item, Save sends only touched fields that differ, at the live version, once. A blank note disables Save; Save always closes the sheet.
- One move UI is `MoveFields` (`DayStrip` plus `SlotTabs`, both on date keys), used by the planned-item sheet, the Move sheet (`/move`) and Plan a recipe; `usePlannedItemSheet` wires both sheets. The day-cards sheet is recipe-only.
- The Remove confirm is shared (`useConfirmRemovePlanned`), titled plain "Remove". `useFreshRows` hands back `settled` with its `epoch`, so the Calendar's growth neither fades rows in nor springs layout.
- Maestro on the iPhone 17: `planned-item-edit` 3/3 (server state via `/planned`, tomorrow's key from `/day`), `plan-from-today` 1/1.
- Seen on the iPhone 17 against a local server: text, day and slot saved as one `editItem` call; a server-side edit with the sheet open and untouched showed the new text and slot with Save disabled; with the note touched and the item moved server-side, Save stored only the note and kept the new day; offline, a text and day edit replayed as one `editItem` on reconnect and the item ended with both. Not seen: the removed row's own exit, swipe-down discard, haptics.
