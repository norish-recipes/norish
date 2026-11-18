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
- Review round 1 (Standards + Spec), dispositions:
  1. fix: solid grouped content left on sheets: Add to pantry rows and their row button (`bg-default`), Manage stores rows, their circle buttons and the skeleton (`bg-surface`/`bg-default`), the Timers sheet's timer buttons, the Planned item thumb (no `onSheet`), `bg-white/20` on the add-recipe sheet (verify).
  2. fix (bug, verify on device): Plan recipe's glass plus sits inside the row's button and both call `planRecipe`, so one tap can plan twice; one press target, and the screen test stops mocking the plus away.
  3. fix: Plan this recipe's day-card plus (`SlotMenu`) got `bg-fill`; row plus buttons are glass on both plan sheets.
  4. fix: `ToggleChip` became `bg-fill` everywhere, the recipe editor's opaque page included; off a sheet it stays solid.
  5. fix: `GlassPill` lost the press feedback the heroui button gave Select all/Deselect all.
  6. fix (verify with a filter on): the Filters dot keeps a solid `border-surface` ring on glass.
  7. fix: `GlassPill` callers work out the radius by hand; buttons and pills drawn on a bare `GlassSurface` in feature files use the shared look (bars, steppers and switch tracks stay).
  8. fix (verify): `FiltersButton`'s bare wrapper `View` and imports the change orphaned; Manage keeps an accessibility label now its text is gone.
  9. ask (Mike): the day strip. Rules names it as `bg-fill` content, the Sheets bullet and the ticket say glass. Built as fill.
  10. reject: the cookbook chips' `bg-default` + `tint.soft`; that is the timer chips' fill the spec asks for.
  11. reject: `DayCardSkeleton className="bg-surface"` on the Calendar; an opaque page keeps a solid fill.
  12. reject: fills inside fills and the colour cast on light rows over a photo; a translucent fill does both, and labels stay readable.
  13. to ticket 43: `sheet-search-field.tsx`'s `bg-surface`, Clear filters overlapping the Categories chips.
- Review round 1 fixed (device-checked, light and dark): 1 (add-recipe `bg-white/20` stays: translucent, on the accent card), 2 (red test first; one tap plans one item), 3, 4, 5, 6 (dot ring dropped; the Library root's Filters is a native header item with no dot), 7.
- 7: `GlassPill` takes `size` (regular/small) and presses with `PressableScale`; new `GlassIconBadge` and `GlassIconMenu`. Nothing else moved: account avatar, view-toggle track, cook bar, stepper and segmented track are composites; the media strip's play and duration are inert badges over a tile that is the press target.
- 8: the `FiltersButton` wrapper `View` is needed to anchor the dot; no dead imports (lint clean); Manage already had its label and testID. Not caught on device: the Manage stores skeleton and a Planned item with no photo.
