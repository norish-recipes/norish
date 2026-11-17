# 42: Glass rule and contrast on sheets

**What to build:** Every control follows the glass rule, and content on sheets separates from the glass. See spec Part 7 ("Rules", "Sheets", "Recipe page").

**Blocked by:** none

**Status:** ready

- [x] Glass: the Library's Filters and lens pills; Add to groceries' Select all/Deselect all and pantry button; Plan recipe's day strip, slot selector and row plus buttons; the cookbooks' Manage (`GlassIconButton` look, no `currentColor`).
- [x] Cookbook chips take the timer chips' fill, no border.
- [x] One translucent `bg-fill` token for all grouped content on sheets; nothing on a sheet is solid.
- [x] Gates green; checked on the device in light and dark.

## Comments

- `--fill`: light `oklch(21.03% 0.0015 150.36 / 0.1)`, dark `oklch(99.11% 0.0015 150.36 / 0.16)` (the foreground at low alpha); `bg-fill` beside `bg-thumb` in heroui-theme.css.
- Moved to `bg-fill`: Add to groceries, Plan recipe (strip, rows, day cards), Add recipe, Add to cookbook, Filters (chips, mode switch), share, servings, grocery form/repeat/stores sheets, pick rows, sheet photo and cookbook-cover placeholders. Day strip and slot control are `bg-fill` chips and `GlassSegmented`; `bg-thumb` is the picked segment.
- Decided: new `GlassPill` (Today uses it too); Manage is icon-only; row plus and pantry buttons are small `GlassIconButton`s.
- Left for ticket 43: pinned `Sheet.Actions` buttons, Clear filters' `bg-warning/20`, `SheetInput`/`SheetSearchField` fills. No untinted recipe exists in the dev data, so only tinted cookbook-chip shots.
