## 1. Native Tabs Shell Setup

- [x] 1.1 Update the Expo Router mobile shell to use native-tabs with the four required destinations: Recipes, Groceries, Calendar, and Profile.
- [x] 1.2 Ensure tab labels/icons and route mapping are product-only and remove any starter-template navigation entries from the tab model.
- [x] 1.3 Configure native-tabs search support so a dedicated search tab entrypoint is available from the tab bar.
- [x] 1.4 Configure native-tabs minimize-on-scroll behavior for eligible scroll-driven tab screens.

## 2. Header Settings Entry and Bottom Sheet

- [x] 2.1 Add a top-right cogwheel action in the shell header that is visible across standard tab destination screens.
- [x] 2.2 Implement HeroUI Native BottomSheet presentation state and open/close handlers at shell scope.
- [x] 2.3 Create the bottom-sheet content for app preferences with an Appearance section.

## 3. Appearance Preference Wiring

- [x] 3.1 Add `light | dark | system` appearance mode selection controls in the settings bottom sheet with clear selected-state indication.
- [x] 3.2 Persist selected appearance mode in the app preference store (default to `system` when unset).
- [x] 3.3 Apply appearance mode changes immediately to the theme provider and restore the saved mode on app startup.

## 4. Validation

- [x] 4.1 Verify bottom navigation behavior on iOS and Android, including tab routing, dedicated search entry, and minimize-on-scroll behavior.
- [x] 4.2 Verify settings cog and HeroUI bottom sheet interaction from each tab destination, including dismissal behavior.
- [x] 4.3 Verify appearance mode persistence and startup defaults for `light`, `dark`, and `system` modes.
