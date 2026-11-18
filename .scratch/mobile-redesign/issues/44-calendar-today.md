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

## Final pass (whole branch, `3048459c7..HEAD`)

Reviewers: Standards (Sonnet), Spec (Opus high), GPT-6.1 Sol. Dispositions:

1. fix: Planned item's recipe row does `router.back(); toRecipe()` with no guard (a double tap backs twice and pushes twice) beside ticket 46's `openAfterSheet`; one close-then-go pattern.
2. fix: `CardSlice`/`ItemSlice` ignore the on-sheet context and default to `bg-surface`; three sheet callers pass `bg-fill` by hand.
3. fix (verify): the tab-accessory probe is mounted once per environment (two native views writing one mark).
4. fix: `homeIndicator` is read two ways (`scroll.homeIndicator` and a direct import).
5. fix: comments still say "native large title" (`card-list.tsx:56,147`, `recipes-stack.tsx:35`); comment blocks over two lines that this range added; exports nothing imports (`sectionAt`, `FULL_SWIPE_EDGE`, `PantryAddInput`).
6. fix (bug): the tag chips' width cache ignores each tag's allergen status, which adds an icon and a heavier weight (Sol).
7. fix (verify): Manage stores' own drag list has no bottom clearance since ticket 43 removed its pinned footer (Sol).
8. fix: `modal-header.test.tsx:306` waits on a real `setTimeout`.
9. docs (Terra, then screenshots): the iPhone guides are out of date (Remove on a planned item, the avatar menu, timer rows, Add to pantry's suggestions, the sheets' header actions), and the Pantry and Ingredients guides do not state the search rule (Sol, Spec).
10. done here: ticket 48's third box and ticket 47's last box said more than their logs; both corrected.
11. ask (Mike): bar items, switches and Today are 44 pt while the recipe page's controls are 40 pt; his "40 pt" answer on ticket 46 was about the recipe page.
12. reject: testIDs no flow references; an element may carry an id before a flow uses it.
- Final fix round: #1-#8 fixed (`a1d77ae16`, `aa1ec62af`, `4a41e9be8`, `edcbaa7a4`, `02efcab5e`, `0a9257bb2`, `28173c7e6`, `6109998c0`, `27e8ba6d0`); #3 held as safe (both probe copies report the same placement in the same millisecond), #7 was real (the last store row was cut off). New from #1's device check: a double tap on the planned item's recipe row lets the second tap reach the Calendar row under the leaving sheet, which opens a second sheet that then sticks. Sent back as a bug.
- Stray tap fixed (`9f630836d`): `after-sheet` keeps a tiny external store of its waiting open, and `SheetTouchShield`, mounted once over the root stack beside the `app` portal host, covers every tab with an empty, VoiceOver-hidden view from the queuing tap until that open runs or is dropped (swipe, unmount, stack reset).
- The sheet is a native modal above the shield, so its dismissal is untouched; on device a double and a triple tap open one recipe, a swiped sheet leaves the Calendar tappable at once, and a timer row tapped twice or followed by another tap opens one cook mode.
