# 08: Signed-in shell

**What to build:** The native tab bar the Recipes tab lives in, with placeholders for the other tabs, and the app plumbing every later ticket needs. See `.scratch/mobile-redesign/spec.md` Part 2 ("Scope and order", "Shared logic first") and the Home and HomeScrolled boards.

**Blocked by:** 07

**Status:** open

- [ ] `NativeTabs`: Recipes (`navbar.nav.home`), Groceries, Calendar, Settings, plus the separate Search tab; the "Add recipe" bottom accessory (opening nothing yet) that minimises on scroll; the account avatar.
- [ ] Groceries, Calendar, Settings and Search are placeholders. Sign out moves to Settings with its native confirm; the smoke screen and its route go (testID `smoke-sign-out` moves with the button).
- [ ] Platform adapter: `toast` through heroui-native and `navigation.toRecipe` (replacing the `log.warn` stub).
- [ ] The shell mounts web's shell subscriptions: `useRecipeOutcomesSubscription`, the config subscription, and the recipe list, ratings, cookbooks, pantry and calendar subscriptions.
- [ ] A bare `/recipe/[id]` route (photo and name) for the Recipe area to replace.
- [ ] Maestro flows that landed on the smoke screen land on Recipes.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
