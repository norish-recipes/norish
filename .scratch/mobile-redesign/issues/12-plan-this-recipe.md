# 12: Plan this recipe

**What to build:** Web's mini calendar for planning a known recipe, used by Plan on a card and Move… on Today, and the after-planning preference on both plan sheets. See `.scratch/mobile-redesign/spec.md` Part 2 ("Planning and groceries") and ticket 07's Plan this recipe board.

**Blocked by:** 10, 11

**Status:** done

- [x] Moved first, in separate commits, web switched over with its unit tests: the range and plan step of `mini-calendar.tsx` and `useAfterPlanning` (`after-planning.tsx`) with its `PlannedGroceries` servings default.
- [x] Days from last month to next month, opened on today; each day card shows what's planned and has an add per slot. The day card is a component the Calendar area can reuse.
- [x] Plan plans and closes; Move moves the Today item and closes.
- [x] Both plan sheets follow `getAfterPlanningPreference`: nothing, open Add to groceries (ticket 13), or add at once.
- [x] The sheet paints cached days or a skeleton in its first frame, and is glass with no solid footer.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Moved to shared-react (`calendar/`): `miniCalendarRange`/`useMiniCalendar`, `usePlanOnDay`, `useAfterPlanning` + `afterPlanningStep` + `plannedServings`; web switched, no behaviour change. New in shared: `useMovePlannedItem` (Move appends to the target slot). `useSlotPlanning`'s and the plan step's `close` now receive the planned recipe id, so a mobile sheet can be replaced instead of closed.
- Plan this recipe and Move share one `plan` sheet (`recipeId` + `name`, or `plannedItemId`); `DayCard` is generic (fixed heights in `day-card-height.ts`, so the list lays out unmeasured and `contentOffset` opens on today). The + is a native SwiftUI `Menu` of the four slots.
- Deviation: the title/close sit above today's card and scroll away on open; a pinned header made cards scroll under the title (no backgrounds allowed). Detent 0.95: a full detent is an opaque sheet.
- After planning: nothing closes; open/add-at-once replace the sheet with `/add-to-groceries` (`recipeId`, plus `addAtOnce=1`). Ticket 13 must default servings to `plannedServings(recipe)`, add at once when `addAtOnce` is set (web's `AddAtOnce` logic), and move web's lines-to-buy into shared.
- Device: only the default (open Add to groceries) was run; nothing/add-at-once are unit-tested (`use-plan-exit`), not set on web. Offline and the first-frame skeleton were not seen.
