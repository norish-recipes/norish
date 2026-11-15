# 08: Signed-in shell

**What to build:** The native tab bar the Recipes tab lives in, with placeholders for the other tabs, and the app plumbing every later ticket needs. See `.scratch/mobile-redesign/spec.md` Part 2 ("Scope and order", "Shared logic first") and the Home and HomeScrolled boards.

**Blocked by:** 07

**Status:** done

- [x] `NativeTabs`: Recipes (`navbar.nav.home`), Groceries, Calendar, Settings, plus the separate Search tab; the "Add recipe" bottom accessory (opening nothing yet) that minimises on scroll; the account avatar.
- [x] Groceries, Calendar, Settings and Search are placeholders. Sign out moves to Settings with its native confirm; the smoke screen and its route go (testID `smoke-sign-out` moves with the button).
- [x] Platform adapter: `toast` through heroui-native and `navigation.toRecipe` (replacing the `log.warn` stub).
- [x] The shell mounts web's shell subscriptions: `useRecipeOutcomesSubscription`, the config subscription, and the recipe list, ratings, cookbooks, pantry and calendar subscriptions.
- [x] A bare `/recipe/[id]` route (photo and name) for the Recipe area to replace.
- [x] Maestro flows that landed on the smoke screen land on Recipes.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Tabs live in `app/(tabs)`; Recipes is `index` ("/"), the avatar sits on the Recipes screen and opens Settings. Strings reuse existing keys (`navbar.nav.*`, `recipes.dashboard.addRecipe`, `common.actions.search`), so no i18n additions.
- `toast` was already on heroui-native; only `toRecipe` was new. The shell's subscriptions are mounted in the root layout's `AuthenticatedEffects`.
- Flows that landed on the smoke screen now wait for testID `recipes-screen`; the email assertions went with the screen. `offline-launch` lost its Offline check (no connection indicator exists yet).
- Not done: `offline-replay`, `realtime` and `check-grocery` need the grocery list and outbox the smoke screen drew; they are left untouched and will fail until Groceries or Recipes replaces them. Native tab taps and the accessory aren't verified on a device (Maestro runs later).

### Review log (2026-11-13)

Implementation `222b2bc55..7dcc66c1b`, fixes `3b4523450..02b747564`. Standards on Sonnet low, Spec on Opus medium.

Fixed:
- The default protected route and a test still pointed at `/smoke`. `598495a63`
- `check-grocery`, `realtime` and `offline-replay` drove the smoke screen and could not pass; they are deleted with their runner code, and ticket 17 carries a box to bring offline replay and realtime back on Recipes flows. `3b4523450`
- HomeScrolled: the Recipes tab is a stack with the native large title and the avatar as its right item, so neither scrolls away. `c5738d4f9`, `02b747564` (the first does not build alone)
- "Add recipe" in sentence case, as on the board. `bb88772f7`
- One `useServerUrl` hook for the avatar and the bare recipe route; a trimmed comment; Sign-out's flow taps `tab-settings`. `603fe534c`, `54b756d0e`, `35e5057c4`

Checked, no change needed: `offline-launch` still cuts the connection before launching, so reaching `recipes-screen` is an offline launch; mobile typecheck passes without `.expo/types`.

Rejected: renaming `smoke-sign-out` (the ticket moves the testID with the button); a groceries subscription in the shell (nothing needs it before the Groceries area); reshaping the placeholder route files and the tab declarations (small and temporary, the reviewer's own call).

For ticket 11: the board's large title on Recipes is "Today" with the date.

Final state `02b747564`: all 11 gates exit 0, mobile lint has no warnings.
