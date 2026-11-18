# 44: Calendar's Today follows the accessory

**What to build:** Today at the bottom right, moving exactly with the accessory. See spec Part 7 ("Calendar").

**Blocked by:** none

**Status:** ready

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
