# 50: Control kit

**What to build:** The content-layer controls of spec Part 8 "The kit", each in one home under `apps/mobile/src/components/`, matching board `kit` and `switch` (/private/tmp/claude-501/-Users-mike-Documents-norish/d38bec8b-911e-4dc6-bbb1-96fe9e0bbaac/scratchpad/boards/kit.png, switch.png; source `Panel.dc.html` panel=kit/switch). Existing callers switch to them; sheet layouts themselves change in 53.

**Blocked by:** none

**Status:** ready

- [ ] Sand content fill as one theme token (light `rgb(234 228 214)`, dark `rgb(46 42 34)`) plus the solid body-button colour and the retuned text colours of `PnOpacity`, defined once where the mobile theme lives; `bg-fill` on content gives way to it.
- [ ] Segmented: one component (standard 44, compact 34, icon), sand track, solid thumb, no glass; `glass-segmented`, `slot-tabs`, `list-switch` callers move to it and the old files go.
- [ ] Stepper: one component (compact, full width), sand track, solid knobs; `glass-stepper` and `servings-stepper` callers move to it and the old files go.
- [ ] Switch: inset (recessed sand track, solid white thumb, accent when on), not glass, used wherever a sheet or page row has an on/off.
- [ ] Field: `sheet-input` / `sheet-search-field` / text area on the sand capsule (text, search with clear, multi-line), one definition.
- [ ] Card and row, Tick and Checkmark, Chip, Icon button (default, accent, danger, disabled), Pill button (default, danger, optional icon), Tag (Active, Expired, On the list) on the kit's look; duplicates of any of them elsewhere in `apps/mobile` are replaced, not left beside.
- [ ] Page uses of the same controls (Groceries/Pantry switch, library All/Recipes/Cookbooks, grid/list switch, Today's stepper) take the kit too: no glass in the content layer.
- [ ] Unit tests for selection, bounds and toggling; gates green.

## Comments
