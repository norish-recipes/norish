# 40: Canvas page for the tab-root headers

**What to build:** A new, separate page in the "Norish iOS" canvas (PXzHGxBxCU4MmwF8scvixz) drawing the tab roots with native large titles, for Mike to review before any code. See spec Part 7 ("Tab roots").

**Blocked by:** none

**Status:** done

- [x] Recipes, Groceries, Pantry and Calendar with a native large title, at rest and scrolled (collapsed title).
- [x] The avatar top right on all four; where Filters, the All/Recipes/Cookbooks pills, the grid/list switch and the Groceries/Pantry switch go (header items vs a row under the title).
- [x] The avatar menu open: status line, Theme, Language, All settings, Sign out; and the Offline state (warning dot, "Offline · 3 changes waiting").
- [x] Today glass at the bottom right on Calendar.
- [x] Light and dark.

## Comments

- Drawn on a new canvas page "Tab roots" (canvas v87): 11 boards from one `TabRoot.dc.html`, all with a `dark` tweak. Large title sits under a transparent bar at rest; scrolled, the bar fades to the background with the inline title centred, and the tab bar minimises into the accessory row, as on the existing HomeScrolled board.
- Default placement (`place: row`): the bar holds only the avatar plus the tab's own tool (Groceries gear, Calendar CalDAV). The grid/list switch (ListSwitch look) sits beside "Your library"; the glass All/Recipes/Cookbooks pills and the glass Filters button are in the row under it; Groceries/Pantry is a full-width labelled glass capsule under the title.
- Alternative (`place: header` on the Recipes, Groceries and Pantry boards): Filters becomes a bar item next to the avatar, and the grid/list and Groceries/Pantry switches become a leading bar item. These stay visible when scrolled, which the scrolled boards show. The Recipes large title stays "Today" with a "Thursday, Nov 5" subtitle, as the app has it.
- Avatar menu: Live has no status line; Offline starts with "Offline · 3 changes waiting". Theme is an inline System/Light/Dark palette, Language opens a submenu ("English ›"), and Sign out sits in its own section. Offline adds a warning dot on the avatar, and the Calendar pill is gone.
- Today: a glass capsule at the bottom right, shown only when today is scrolled off screen. The `bar` tweak on the scrolled Calendar board shows it above both the minimised and the expanded accessory. Not drawn: VoiceOver ("Mike, Offline" is only the aria-label) and motion.
- Review round 1 (canvas v88):
  1. The Recipes large title and the collapsed title are "Recipes". "Today" is now a section heading in the content, with "Thursday, Nov 5" beside it.
  2. Dark segmented switches (grid/list, Groceries/Pantry, All/Recipes/Cookbooks) get a lighter thumb token (`--thumb`, oklch 43%), so the selected segment stands out from the glass track. Light keeps the surface-white thumb.
  3. Confirmed in the markup and render. The menu was 86–88% opaque, so card text showed through by the Sign out row, and an 8 px `--msep` band sat above it. The menu is now one glass surface at 95–96% opacity, the band is gone, and every section break is the same full-width 1 px separator. Separators between items inside a section were dropped, as in iOS menus.
  4. `place=header` on Recipes puts All/Recipes/Cookbooks in a glass segmented control in the bar's bottom palette. At rest it sits right under the large title, and when scrolled it stays pinned under the inline title. The pills row under "Your library" is gone in this option.
  5. The `header` Groceries/Pantry switch uses the same labelled segments as `row`. When scrolled, the inline title is hidden because the switch already names the tab.
  6. A canvas note beside the Groceries/Pantry row says that with `place: row` the switch scrolls away with the list.
  7. A canvas note beside the Calendar row says Calendar has no switches or pills, so `place` does not apply.
