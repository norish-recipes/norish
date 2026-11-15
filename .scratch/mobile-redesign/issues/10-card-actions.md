# 10: Card actions

**What to build:** Swipe and context-menu actions on every recipe and cookbook card. See `.scratch/mobile-redesign/spec.md` Part 2 ("Card actions") and the HomeSwipe board. The sheets the actions open come in 12–14; until then those actions are wired to the routes those tickets fill.

**Blocked by:** 09

**Status:** done

- [x] Moved first, in separate commits, web switched over with its unit tests: the ownership rule `userId ? canX(userId) : true` (five web components) and the mutation toasts (`hooks/use-recipes-mutations.ts`: queued offline vs safe error).
- [x] Swipe in list and grid: Groceries, Plan, Delete, per the board's circles.
- [x] Native context menu: Favourite/Unfavourite, Groceries, Plan, Add to cookbook, Delete, and Remove from cookbook inside a cookbook.
- [x] Delete only when permitted, confirmed with the native alert.
- [x] Double-tap the photo toggles Favourite with a light haptic.
- [x] Cookbook cards: Add recipes, Rename, Delete.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Moved first: `ownerAllows` (reader) and `useRecipeMutationErrorToast` (recipes, through the platform toast: queued = warning, else default "operation failed"); web uses both, `queued-offline-toast.ts` and its test went. Web's old `use-recipes-mutations` tests live in shared-react now.
- Menu is expo-router `Link asChild` + `Link.Menu` (iOS native menu, lifted card, no blur) as pure menu host; taps, the photo's double tap (single tap waits only on the photo) and swipe (`ReanimatedSwipeable`, boards' 48/44 pt circles) are RNGH. Added theme tokens `shop`, `shop-foreground`, `plan` (shared theme) and 5 i18n keys.
- Placeholder routes: `plan`, `add-to-groceries`, `add-to-cookbook`, `cookbook-add-recipes`, `cookbook-rename` (formSheets) and a bare `/cookbook/[id]` so cookbook cards have something to open. Cookbook cards get the long-press menu and VoiceOver actions only; no swipe (no board).
- `RecipeCard` takes an optional `cookbook` that adds Remove from cookbook; the cookbook screen (14) must pass it. Not checked on a device: gesture interplay (swipe vs menu vs double tap), panel sizes, menu lift.

### Review log (2026-11-13)

Implementation `69a5e6a93..478f69d55`, fixes `fa60b26bb..1714b2852`. Standards on Sonnet low and Spec on Opus medium, two simulator passes on the iPhone 18 Pro against the boards (light and dark), then Spec on Opus high over the fix range because it reached session handling and offline persistence.

Fixed, card actions:
- One set of action definitions and one menu hook for both cards, typed by the action union; the destructive flag, label and icon sit with the definition. `af5274b6c`, `d5f8483e9`, `446aa72ff`
- Cards are accessible elements with their testID, label and actions (the accessible view sat inside the context-menu link, which iOS does not expose); a favourite reads its state. `892bdf8bd`, `bf9551f00`
- The swipe's Plan icon is a plain calendar and the circles' shadow is the board's; the pending card shows its link's host (the started event's link was dropped). `43cc05973`, `7d429ad5c`
- Web's toast-severity and import-error tests are back; the phone no longer shows the browser-console line in a failure toast. `fa60b26bb`, `55f588562`

Fixed, found on the device while checking tickets 08-10:
- The Filters sheet was empty after a fix made without a device; its content scrolls above the buttons, which sit on the sheet's glass with no solid strip. `49c8c2728`, `1014de05b`
- Photos never loaded: image requests lacked the session cookie. The cookie now goes only to the Server Address's origin and is read from the Keychain once. `f0c5fa0a5`, `b95d5cdce`, `088df2fc6`
- The signed-in launch: the tree no longer re-keys when the session settles on its own account, and the query cache is saved at most once a second and flushed on background (it was re-saved about 300 times per launch). Web flushes on `visibilitychange` and `pagehide`, and its IndexedDB writes commit at once so an unload flush lands. `e5e0fba98`, `fc8c6fb33`, `0878cf784`, `91f290676`, `e3fda613f`
- Favourites changed elsewhere reach the app: restored reads refetch when their screen shows, stale ones on return from the background (not from Face ID or the share sheet). `026da61f4`, `9d79606ac`

Checked, no change needed: dark mode follows the system (the simulator had ignored the setting until rebooted); Reduce Motion already holds through the swipeable's spring config; web's which-actions rule has a different shape, so only `ownerAllows` is shared; the list swipe matches the board (the board PNGs carry a 24 px frame offset); a long-press that lifts opens nothing behind the menu; different recipes show their own photos in list, grid, a cookbook cover and the recipe route (twelve test photos in a scratch uploads folder).

Rejected: separators and text size in the long-press menu and buttons with icons in the delete confirm (both are the system's, as the spec asks); the Plan icon in the menu (SF Symbols has no plain calendar); a shared flush-on-leaving hook (the platform events differ); the placeholder matching of pending imports (older than this branch).

For ticket 14: the green "+" on the Cookbooks lens; the cookbook page must pass its cookbook to `RecipeCard`, or Remove from cookbook never shows; the bare `/cookbook/[id]` route's back button overlaps its title.

Asked and answered (maintainer, 2026-11-13): cookbook cards have the long-press menu only, no swipe.

Not seen on a device: a favourite's heart over a real photo; the pending card's accessibility node.

Final state `1714b2852`: all 11 gates exit 0, mobile lint has no warnings, `offline.e2e.ts` passed 100 of 100 over five repeats.
