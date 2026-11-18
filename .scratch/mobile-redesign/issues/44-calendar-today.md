# 44: Calendar's Today follows the accessory

**What to build:** Today at the bottom right, moving exactly with the accessory. See spec Part 7 ("Calendar").

**Blocked by:** none

**Status:** done

- [x] Today is glass at the bottom right above the accessory.
- [x] A small native module reports the accessory's real placement (inline or expanded); `nextTabBarMinimised`'s scroll guess goes where the real state replaces it (check the library footer and the tab lists' end padding from ticket 38 too).
- [x] The control moves with a layout transition, never a jump.
- [x] Gates green; checked on the device scrolling up and down.

## Comments

- Placement comes from UIKit's `UITraitTabAccessoryEnvironment` trait (`traitCollection.tabAccessoryEnvironment`, `.inline`/`.regular`). react-native-screens 4.30 emits it natively (`onEnvironmentChange`) but its `TabsHost.ios.tsx` passes no handler, so a local module (`modules/tab-accessory-placement`) mounts a zero-size native view inside the accessory that reads its own trait and reports changes into a mark (`useTabBarMinimised`).
- What the bar really does (iOS 27.2 sim, probe logged): on all four tabs it minimises on the first scroll down and expands only on a bounce at a list edge or a tap on the minimised bar, never on a mid-list scroll up, fast or slow. Ticket 41's differences were that rule, not registration: Groceries' and Pantry's short lists bounce, Recipes needs the top, and the Calendar has no edge (it grows both ways), so it expands only on a tap. Insets and `maintainVisibleContentPosition` were ruled out by experiment. No fault fixed; whether the Calendar should stop minimising is Mike's call.
- Moved off the guess: Today and the load-more footer read the real placement. Deleted: `nextTabBarMinimised`, `useTabScroll`'s `minimised` and focus reset, their tests; `use-tab-bar-minimised.ts` became `home-indicator.ts`. Tab lists keep the expanded end padding: a list's end bounce expands the bar, and padding that shrank when minimised would pull the list back.
- Today: untinted `GlassPill` (the avatar's glass, Mike), right edge on the Search button's (28 pt minimised, 21 expanded, measured), 7 pt over the accessory (`TAB_BAR_ACCESSORY_GAP`, Mike), `todayControlPlace` unit-tested. It springs `bottom`/`right`: a layout transition or a transform left the pill's glass blank after a move.
- Device (Release, iPhone 17 iOS 27.2, light + dark): Today follows the bar frame by frame, tap scrolls to today. Maestro first run: `calendar-plan-accessory`, `calendar-drag`, `calendar-offline`, `timer-from-accessory`, `recipes-browse-filter`, `groceries-tick-clear`, `pantry-filter-remove` pass (before the tint and spacing fixes); full run waived by Mike. No flow taps Today.
- Mike, in the implementer's thread (2026-11-18): Today takes the same glass as the avatar menu and its right edge lines up with the Search button; "The full maestro run can be skipped and marked done, after the last fix this ticket is done". Closed on his word without a per-ticket review; the whole-branch review reads its commits (`4b475db1d`, `027e35374`, `c65a5c0bb`) first-hand.
- Exit gate on `a9710dfe5`: all seven gates exit 0. The seven Maestro flows passed before the glass and spacing fixes and were not re-run after them.
- Ticket 41's carried question is answered: the bar minimises on the first scroll down and expands only when a list bounces at its end or the minimised bar is tapped. Ask for Mike: the Calendar has no end, so its bar expands only on a tap; should it minimise at all.
