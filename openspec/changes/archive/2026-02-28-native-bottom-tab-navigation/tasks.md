## 1. Verify Prerequisites

- [x] 1.1 Confirm `@react-navigation/bottom-tabs` v7.7.3+ is installed and the `/unstable` sub-path export is accessible (`import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable'`)
- [x] 1.2 Confirm Expo SDK 53 / React Native 0.79+ and latest `react-native-screens` are in use (required by `createNativeBottomTabNavigator`)

## 2. Replace Tab Navigator in `(tabs)/_layout.tsx`

- [x] 2.1 Remove `NativeTabs` import from `expo-router/unstable-native-tabs` and add `createNativeBottomTabNavigator` import from `@react-navigation/bottom-tabs/unstable`
- [x] 2.2 Create the navigator with `createNativeBottomTabNavigator()` and configure `tabBarMinimizeBehavior: "onScrollDown"` at the navigator level
- [x] 2.3 Add the Recipes tab screen with its SF Symbol icon (`book` / `book.fill`) and label, preserving the existing route
- [x] 2.4 Add the Groceries tab screen with its SF Symbol icon (`cart` / `cart.fill`) and label
- [x] 2.5 Add the Calendar tab screen with its SF Symbol icon (`calendar` / `calendar.circle.fill`) and label
- [x] 2.6 Add the Profile tab screen with custom SF Symbol `person.crop.circle` (inactive) / `person.crop.circle.fill` (active) on iOS and an equivalent icon on Android using `Platform.select`
- [x] 2.7 Remove the fifth search tab trigger (`NativeTabs.Trigger name="search" role="search"`) — no search slot in the tab bar
- [x] 2.8 Preserve `tintColor` (accent), `tabBarActiveTintColor`, and inactive icon color theming from `useThemeColor`
- [x] 2.9 Keep `SettingsSheetProvider` and `AppearanceSettingsSheet` wrapping the navigator as before

## 3. Implement Native Search Tab on iOS 26+

> **Approach changed**: replaced custom `bottomAccessory` search bar with `tabBarSystemItem: 'search'` + `headerShown: true` + `headerSearchBarOptions` for a fully native search experience. The `SearchAccessory` component was removed.

- [x] 3.1 ~~Create a `SearchAccessory` component~~ → replaced by native `tabBarSystemItem: 'search'` tab
- [x] 3.2 ~~Wire `SearchAccessory` `onPress` to navigate to `/search`~~ → search is native; no push navigation needed
- [x] 3.3 ~~Set `bottomAccessory` on Recipes tab~~ → replaced: added `search` tab screen in layout with `tabBarSystemItem: 'search'`, `headerShown: true`, `headerLargeTitleEnabled: true`, and `headerSearchBarOptions`
- [x] 3.4 Updated `search.tsx`: removed custom `ShellHeader` + `SearchField` UI; wired native search bar `onChangeText` via `navigation.setOptions` to drive the existing recipe filter logic

## 4. Update Spec File

- [x] 4.1 Apply the delta changes from `openspec/changes/native-bottom-tab-navigation/specs/mobile-native-tabs-navigation/spec.md` into `openspec/specs/mobile-native-tabs-navigation/spec.md` — update the search requirement to reflect `bottomAccessory`, add the custom profile icon requirement, and remove the `role="search"` trigger requirement

## 5. Search Filter UI

- [x] 5.1 Define `SearchFilters` type (course, maxCookingTime, liked, minRating, tags) and `FILTER_PRESETS` constant in a new `src/lib/recipes/search-filters.ts` file
- [x] 5.2 Create `src/components/search/filter-chip-row.tsx` — horizontal scrollable row of quick-filter preset chips; active chips are visually highlighted; tapping a chip toggles the corresponding filter
- [x] 5.3 Create `src/components/search/filter-sheet.tsx` — `BottomSheet` drawer with sections: Cooking Time, Categories, Tags, Favorites, Min Rating; staged-apply pattern (draft state, Apply + Reset footer)
- [x] 5.4 Extend `filteredRecipes` memo in `search.tsx` to filter by `course`, `totalDurationMinutes`, `liked`, and `rating` in addition to the text query
- [x] 5.5 Add a filter button to `search.tsx` (via `navigation.setOptions` `headerRight`) that opens the filter drawer; wire filter preset chip row above the scroll list; connect filter state to both the chip row and the drawer

## 6. Validation

- [ ] 6.1 Test on iOS 26 simulator: native search tab appears in tab bar, tapping it expands the search bar in the header, typing filters the recipe list
- [ ] 6.2 Test on iOS 18 or lower: tab bar always visible (no minimize), search tab present, `headerSearchBarOptions` degrades gracefully
- [ ] 6.3 Test on Android: all five tabs render correctly with icons and labels (search uses drawableResource fallback), no crash
- [ ] 6.4 Verify deep linking and back navigation still work correctly with Expo Router screen files
- [ ] 6.5 Verify the `AppearanceSettingsSheet` (settings gear) still opens correctly from within the new navigator wrapper
