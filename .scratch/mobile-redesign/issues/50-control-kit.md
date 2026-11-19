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

- Review round 1 (Standards + Spec), dispositions:
  1. fix: glass in sheet bodies: `grocery-line-row.tsx:74` tray GlassIconButton, `plan-recipe-screen.tsx:150` plus GlassIconButton, `import-photos-screen.tsx:134` GlassCloseButton photo remove -> kit IconButton (solid; board `.rm` uses --thumb).
  2. fix: duplicate controls beside the kit: `repeat-view.tsx:67-95` hand-built minus/value/plus -> Stepper; `store-list-row.tsx` CircleButton, `timer-list.tsx` RoundAction, `add-to-cookbook-screen.tsx:67-77,109-117` round Pressables -> IconButton; `add-groceries-screen.tsx:83-93` switch row -> CardRow; `choice-list.tsx:40` Ionicons checkmark -> Checkmark; `grocery-line-row.tsx` OnTheList (HeroUI Chip) and `pantry-rows.tsx` OnTheListChip -> one shared Tag use.
  3. fix: `add-to-groceries-screen.tsx:160-172` and `detail-cards.tsx:250-262` repeat the same Stepper + AnimatedNumber servings wrapper -> one component.
  4. fix: `recipe-servings-screen.tsx:81-102` bespoke scale pills -> ToggleChip with an even (flex-1, centred, no padding) row variant per board `.chips.even`.
  5. fix (verify): hand-rolled bg-sand card rows in `add-recipe-screen.tsx:135`, `plan-recipe-screen.tsx:78,119,141`, `pick-row.tsx:12` -> Card/CardRow (or the kit's slice API) where they are the same shape.
  6. fix: comments over two lines in `card.tsx:19-21`, `pill.tsx:33-35`, `segmented.tsx:6-8`, `stepper.tsx:41-43`.
  7. fix (verify): `lib/slot-segments.ts` exports a hook; rename to the repo's `use-*` file convention if AGENTS.md/CONTRIBUTING.md states it.
  8. fix (verify): `on-sheet.tsx:3-9` still describes a translucent fill; if the on-sheet/off-sheet distinction is dead now that sand is solid everywhere, delete it and its callers' branching, else fix the doc.
  9. fix (verify): kit components mix `useThemeColor` (card, pill, stepper) and `useTokenColor` (segmented) for the same kind of read; use one.
  10. fix: hairline stroke (board: `.field,.area,.chip,.day,.sw,.card{box-shadow:inset 0 0 0 .5px var(--stroke)}`) missing on Segmented, SHEET_FIELD/SHEET_TEXT_AREA, ToggleChip, DayStrip.
  11. fix: dividers: CardRow uses `border-separator` (opaque); board `--line` is oklch(45% .03 85 / .15) light, oklch(100% 0 0 / .1) dark -> a mobile line token.
  12. fix: Segmented sizes per board: icon buttons 44 wide (standard) / 34 (compact), compact text 13px with `flex:none; padding 0 13px`.
  13. fix: CardRow dot 10pt (was 8), value max-width 62% (was 55%).
  14. fix: ToggleChip icon per board `.i.f`: 15pt, warning colour when off, currentColor when on.
  15. fix (verify): Tag per board `.tag{height:24px;padding:0 9px;gap:5px}`; apply to the Tag use only if recipe-card fact pills share `size="row"` and their board differs.
  16. fix: SHEET_TEXT_AREA radius 22 (board `.area`), was rounded-3xl.
  17. reject: ViewToggle should be standard 44: spec Part 8 "Sizes" says the icon switch shares the compact height (34).

- Round 1 fixes: 1-6 and 9-16 done in three commits (solid buttons, shared controls, kit hairlines/line token/sizes). The new `--line` token (`border-line`) is on the kit card, pick rows and plan rows; `Pill` got a `tag` size (24 / px 9 / gap 5) for the status tags only, because recipe-card fact pills share `row`.
- Servings stepper + number is `components/servings-stepper.tsx` (the hook moved in, `lib/use-servings-stepper.ts` deleted); `OnTheListChip` moved to `components/` so recipes and groceries share it.
- Verify items that didn't hold: 7 (no `use-*` file rule in AGENTS.md/CONTRIBUTING.md, `lib/` also holds `asSlot`) and 8 (the on-sheet split is live: off a sheet rows are `bg-default`/`bg-surface`, so only its doc changed). 5: the sliced rows now share `pickRowClass`, the add-recipe list is a `Card`.
