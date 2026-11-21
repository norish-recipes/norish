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

### Review log (2026-11-13)

Implementation `dd5de8629..bd0e46b32`, fixes `9decbc827..046e3c840`. Standards on Sonnet low and Spec on Opus medium; the implementer and the fixer each checked the sheet on the iPhone 18 Pro in light and dark, the fixer with measurements.

Fixed:
- The header is pinned on the sheet's glass with the days scrolling below it, as the board draws; the first build let the title and close button scroll away. Title, close button and first card sit 26 / 29 / 83 pt below the sheet's top (board 27 / 28 / 86). `046e3c840`
- The day card, its heights, the card photo and the slot icons live in `apps/mobile/src/components/`, so the Calendar area can import them. `9decbc827`
- Move closes the sheet when its item no longer exists, and the hook looks the item up by id. `5ed236ac0`
- The route params become one plan-or-move mode; one day formatter; the card's numbers and classes sit together with a test that they agree; both sheets call their exit `exit`; the file is `plan-calendar-screen.tsx`. `046e3c840`, `b4f2bcc0f`, `36ef42bcb`
- Web's mini calendar closes without a hand-written callback. `e3e65f581`

Checked, no change needed: web is unchanged by the moves (mini calendar and after-planning compared line by line; no web test deleted); Move is one `moveItem` mutation with an optimistic update; offline with nothing cached the day cards show empty with their "+" (TanStack's `isLoading` is false for a paused fetch); the after-planning choice is read on every render; Plan from a swipe and all three after-planning choices ran on the device.

Rejected: closing into Add to groceries when the plan later fails and rolls back (web does the same).

Deviations left, with their reason:
- The sheet is 764.6 pt tall with its top at y=101; the board has 804 pt from y=62. At a 0.99 detent iOS draws the sheet opaque and full-width, so 0.98 is the tallest glass sheet. `36085d525`
- react-native-screens lays a sheet's content out at 402 pt and shows it at 0.96, so everything on a sheet is about 4% smaller than the board.
- The slot menu is the system menu (250 x 42 pt; the board draws 210 x 44).

For ticket 13: "add at once" still opens the Add to groceries placeholder; the servings default (`plannedServings`) is not passed in the route.

Final state `046e3c840`: all 11 gates exit 0, mobile lint has no warnings.
