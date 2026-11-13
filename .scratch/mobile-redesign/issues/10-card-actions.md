# 10: Card actions

**What to build:** Swipe and context-menu actions on every recipe and cookbook card. See `.scratch/mobile-redesign/spec.md` Part 2 ("Card actions") and the HomeSwipe board. The sheets the actions open come in 12–14; until then those actions are wired to the routes those tickets fill.

**Blocked by:** 09

**Status:** done (device pass pending)

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
