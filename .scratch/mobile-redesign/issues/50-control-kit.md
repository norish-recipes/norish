# 50: Control kit

**What to build:** The content-layer controls of spec Part 8 "The kit", each in one home under `apps/mobile/src/components/`, matching board `kit` and `switch` (/private/tmp/claude-501/-Users-mike-Documents-norish/d38bec8b-911e-4dc6-bbb1-96fe9e0bbaac/scratchpad/boards/kit.png, switch.png; source `Panel.dc.html` panel=kit/switch). Existing callers switch to them; sheet layouts themselves change in 53.

**Blocked by:** none

**Status:** ready

- [x] Sand content fill as one theme token (light `rgb(234 228 214)`, dark `rgb(46 42 34)`) plus the solid body-button colour and the retuned text colours of `PnOpacity`, defined once where the mobile theme lives; `bg-fill` on content gives way to it.
- [x] Segmented: one component (standard 44, compact 34, icon), sand track, solid thumb, no glass; `glass-segmented`, `slot-tabs`, `list-switch` callers move to it and the old files go.
- [x] Stepper: one component (compact, full width), sand track, solid knobs; `glass-stepper` and `servings-stepper` callers move to it and the old files go.
- [x] Switch: inset (recessed sand track, solid white thumb, accent when on), not glass, used wherever a sheet or page row has an on/off.
- [x] Field: `sheet-input` / `sheet-search-field` / text area on the sand capsule (text, search with clear, multi-line), one definition.
- [x] Card and row, Tick and Checkmark, Chip, Icon button (default, accent, danger, disabled), Pill button (default, danger, optional icon), Tag (Active, Expired, On the list) on the kit's look; duplicates of any of them elsewhere in `apps/mobile` are replaced, not left beside.
- [x] Page uses of the same controls (Groceries/Pantry switch, library All/Recipes/Cookbooks, grid/list switch, Today's stepper) take the kit too: no glass in the content layer.
- [x] Unit tests for selection, bounds and toggling; gates green.

## Comments

- Tokens live in `apps/mobile/src/global.css` (`--sand`, `--stroke`, `--tick-border`, and the retuned `--muted`, `--field-placeholder`, `--accent-text`); the body-button colour is the existing `--thumb`. `--fill` is gone from the shared theme; `bg-fill` is now `bg-sand` everywhere.
- Segmented, Stepper, Switch, Card/CardRow, IconButton, PillButton, Checkmark, Tick (was RoundTick) and Pill (moved to `components/`, tones `active`/`expired`) each have one home; the old files are deleted. `list-switch`, `slot-tabs` and `servings-stepper` became data hooks (`use-list-segments`, `slot-segments`, `use-servings-stepper`).
- Deviation: Field keeps `SheetInput`/`SheetSearchField`/`SheetTextArea` and their one `SHEET_FIELD` definition, now sand, instead of a rename. The Pantry search keeps its `bg-surface` page override. ToggleChip is the Chip.
- Left for 52/53: day-card's glass `+` menu, small inline clear/remove buttons in import-link and add-to-cookbook, and the aisle footer card. Today's own glass pill stays glass.
