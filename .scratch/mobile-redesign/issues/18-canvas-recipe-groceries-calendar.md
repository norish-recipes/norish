# 18: Canvas session for Recipe, Groceries and Calendar

**What to build:** The boards the canvas still lacks for Parts 3–5, drawn by Mike in the "Norish iOS" canvas before any of their code. See `.scratch/mobile-redesign/spec.md` Part 3 ("Scope and order").

**Blocked by:** 17

**Status:** done

- [x] Calendar empty and offline.
- [x] Recipe Timer chips on the Recipe page's steps (idle, running, paused, done).
- [x] Live Activity: Lock Screen (one timer, three, three plus "+N", paused), Dynamic Island compact, minimal and expanded, and the timer-done state.
- [x] Small calendar widget: a planned recipe, a note, nothing planned.
- [x] Large week widget: today and the next six days.
- [x] Widgets signed out ("Open Norish to sign in") and with their data run out ("Open Norish").
- [x] Every widget board in light, dark, tinted and clear.

## Comments

- 2026-11-14: first pass on canvas v75, waiting for Mike's review. Boards: Calendar `state` planned|empty|offline (CalendarEmpty, CalendarOffline); RecipeSteps `timers` (RecipeTimers: done, running, paused, idle); new row "Recipe Timers · Live Activity" (LockScreen `state` one|three|more|paused|done, DynamicIsland `state` compact|minimal|expanded|done); new row "Calendar widgets" (WidgetsSmall and WidgetLarge, `look` light|dark|tinted|clear, WidgetLarge `state` week|signedOut|runOut).
- 2026-11-14 (v76-v78): Mike's review round: check circles 24/14 on every board (code value), "Done"/"Paused" 15px, roomier week widget, small widgets with the date on top and slot + name at the bottom, app-icon filler removed. Also drawn beyond this ticket: drag states (GroceriesDrag into an aisle, CalendarDrag to another day) and every Settings sub-page (SettingsPage board, `page` profile|preferences|allergies|household|tokens|apiKeys|shareLinks with overlays), which no ticket covers yet.
- 2026-11-14 (v79): settings lists get small swipe actions (tokens Delete; API keys Disable + Delete; share links Revoke + Delete; household member Admin + Kick) and a long-press menu on the same rows, no ⋯ buttons. Manage stores reordering drawn (GroceriesStoresDrag).
