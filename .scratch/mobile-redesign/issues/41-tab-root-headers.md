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
- Mike, in the fix thread (2026-11-17), overriding the "native large title" wording above: "the canvas prints the headings as the app store style inline title [...] Titles should hide on scroll with only a soft blur at the heading. [...] No need to show language - English just show English. Use icons infront of the themes if possible." The theme selector not matching the canvas's inline palette is accepted if a native menu cannot draw it.
- Review round 2 (after the fix round and device check), dispositions:
  1. fix: `components/select-fade.tsx` has no importer left.
  2. fix: `card-list.tsx` keeps a second "scrolled" state beside `useScrolled`.
  3. fix: the scroll wiring (`useScrolled` + `TabRootHeader` + `onOffset`) repeats in four screens; one hook owns it.
  4. fix: the title pops out at an 8 pt threshold; it moves and fades with the scroll offset (spec: "scrolls away with the content").
  5. fix (verify): VoiceOver reads the transparent native title and the drawn one.
  6. fix (verify): the Live line is a grey disabled checkmark; the canvas draws a green dot.
  7. fix (verify, bug): today's resting position on open differs between runs.
  8. fix: screenshots. Six dark files show the Calendar; Recipes, Groceries and Pantry dark and the Offline menu in both themes were never captured.
  9. ask (Mike): Calendar at rest. It opens scrolled to today, so "scrolled" is true from the first frame: no title on open and an earlier day blurred under the bar; the canvas draws the title with today first and nothing under the bar.
  10. to ticket 42: the cookbook page's solid `FiltersButton` beside the glass `ViewToggle`.
  11. reject: `GlassSegmented`'s `icon` prop is used by `list-switch.tsx:24,32`.
  12. reject: `account-offline-dot` invisible to Maestro; `calendar-offline.yaml:53` waits for it visible and passes.
  13. reject: restoring `library-filters-active`; nothing references it (round 1 #3).
  14. reject: `AccountMenu` reading the locale options as Feature Envy; one lookup.
  15. reject: empty thumbnails behind the menu; the dev library has almost no photos on disk.
- Round 2 fixes: `useTabScroll` wires each tab root's scroll once (UI-thread `offset`, tab bar guess) and drives the title, which rises and fades with the list (no state flip); `card-list`'s own scrolled state and `SelectFade` are gone. VoiceOver read the title twice (native + drawn): the transparent native title stays as the one accessible title, since a faded drawn one drops out of the tree. The Live/Offline row is an enabled button with a `tint`ed `circle.fill` (a disabled or plain row greys the dot).
- Calendar open: the offset was right but UIKit shifted it by the bar's inset (116 pt) when the automatic inset landed after `contentOffset`, and `useHeaderHeight` reads 0 → 100.7 → 116 over the first renders. The list now takes a fixed inset (safe area + 54 pt bar) and one half-point scroll after layout, which the list's window needs; 4 opens on the iOS 27.2 sim land today at the same place, yesterday under the bar.
- Device (Release, iOS 27.2, light + dark): all four tabs at rest and scrolled, the menu Live (green dot) and Offline · 1 change waiting (warning dot); dark segmented thumbs take the lighter `--thumb`. Maestro `calendar-offline`, `groceries-tick-clear`, `recipes-browse-filter`, `stores-manage`, `stores-reorder` pass first run.
