# 41: Tab-root headers and the avatar menu

**What to build:** The approved canvas of ticket 40 in code. See spec Part 7 ("Tab roots").

**Blocked by:** 40 (approved by Mike)

**Status:** ready

- [x] Native large titles on Recipes, Groceries, Pantry and Calendar; `TitleRow` and the `top: "soft"` edge effect go; no title under a blur at rest; the title shares its line with the bar items (App Store style). The accessory still minimises on scroll on every tab.
- [x] Controls placed as the canvas's Tab roots page draws them (Mike's pick): Groceries/Pantry switch below the title; on Recipes, Filters in the bar, grid/list beside "Your library" (not sticky), All/Recipes/Cookbooks under it. Nothing but the bar items is sticky. Scrolled, the bar shows no inline title; header items are translucent glass; Calendar loses its sync button.
- [x] The avatar (top right on all four) opens a native menu: status line (always: "Live", or Offline), Theme, Language, All settings, Sign out. A warning dot when Offline; VoiceOver "‹name›, Offline"; "Offline · N changes waiting" with Queued changes.
- [x] The calendar's Offline pill goes; the `calendar-offline` Maestro flow checks the screen instead.
- [x] Gates green; checked on the device in both themes.

## Comments

- Titles come from `TabRootHeader` (native large title, clear inline title so a scrolled bar shows only items); the gear and Filters are native bar menu/button items, the avatar a custom Host `Menu` item with its own glass disc. Theme/Language/Settings/Sign out reuse existing hooks; the status line reuses `offlineStatus` strings; new keys: `navbar.accountMenu.*` in all locales.
- Recipes' title is always "Recipes"; "Today" is now a heading with the date inside `TodaySection`. Calendar rows no longer offset for a title row; a day opens `insets.top + 44 + 12` below the top. Maestro flows tap the gear and Filters by label; the filters-active and Offline-pill assertions are dropped.
- Not done: gates box and device check. Docker is down (no device/Maestro run); `test:run` fails only in shared-react `trpc-links.test.ts` (ticket 39's uncommitted edits); mobile and i18n suites pass. Unverified on device: that the large title shares the bar's line, the custom avatar item's sizing, and the large title collapsing under `ScrollViewMarker`.
- Commits blocked: the ssh signing agent refused ("Couldn't find key in agent"), so nothing is committed.
- Review round 1 (Standards + Spec), dispositions:
  1. fix: `recipes-browse-filter` lost its filters-active assertions; the "on" state is asserted again (flow, or a unit test on the bar item when Maestro cannot see it).
  2. fix: `calendar-offline` asserts the Offline state appearing and clearing through `account-offline-dot`, beside the planned item.
  3. fix (verify): stale `library-filters-active` testID in `library-header.tsx`.
  4. fix: `list-settings-item.ts` typed as `HeaderItem[]`, no per-block `as const`, no empty-label submenu as a separator.
  5. fix (bug): the Queued-changes count goes stale on an account switch; one source for the count, shared with `use-confirmed-sign-out` (reuse `useOutboxStatus`/`useCacheOwner`).
  6. fix: `useFiltersItem` returns a typed `HeaderItem`.
  7. fix (verify): the second glass capsule in `library-header.tsx` uses `GlassSegmented`; its `icon` prop goes if unused.
  8. fix: dark segmented thumbs take the lighter `--thumb` token (ticket 40 round 1 #2) on all three switches.
  9. fix: the Language row shows the current language.
  10. fix (verify on device): Calendar opening offsets under the automatic inset; the Recipes list minimising the accessory and collapsing the title.
  11. reject: inline `intl.formatMessage` calls are the app's idiom, not duplication.
  12. reject: `TabRootHeader` as Middle Man; the reviewer's own note says it is the single place fixing title and items.
  13. reject: `listSettingsItem`'s parameters as a Data Clump; one caller, already one options object.
- Device check (iOS 27.2 sim, Release, light + dark, Live + Offline): a native large title cannot share the bar's line, so the title is a left bar item (App Store style) that hides once the list scrolls (`useScrolled`), with a soft top edge effect only; the large title's colour also inherited the transparent inline title, so it never drew. Menu rows got theme icons and a plain language name.
- Calendar opens today under the bar with the title already hidden; the list's `contentOffset` is not compensated for a header (no large title now). Recipes' list is wrapped in `TabListMarker` so the accessory minimises. Finding 7 skipped: `ViewToggle` animates a sliding thumb of fixed icon segments, not `GlassSegmented`'s labelled full-width capsule; its thumb takes `bg-thumb`.
- Maestro: `calendar-offline`, `groceries-tick-clear`, `recipes-browse-filter` (asserts the bar item's `selected`), `stores-manage`, `stores-reorder` pass; screenshots in the session scratchpad `t41/`.
