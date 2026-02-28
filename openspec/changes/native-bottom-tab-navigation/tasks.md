## 1. Verify Prerequisites

- [ ] 1.1 Confirm `@react-navigation/bottom-tabs` v7.7.3+ is installed and the `/unstable` sub-path export is accessible (`import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable'`)
- [ ] 1.2 Confirm Expo SDK 53 / React Native 0.79+ and latest `react-native-screens` are in use (required by `createNativeBottomTabNavigator`)

## 2. Replace Tab Navigator in `(tabs)/_layout.tsx`

- [ ] 2.1 Remove `NativeTabs` import from `expo-router/unstable-native-tabs` and add `createNativeBottomTabNavigator` import from `@react-navigation/bottom-tabs/unstable`
- [ ] 2.2 Create the navigator with `createNativeBottomTabNavigator()` and configure `tabBarMinimizeBehavior: "onScrollDown"` at the navigator level
- [ ] 2.3 Add the Recipes tab screen with its SF Symbol icon (`book` / `book.fill`) and label, preserving the existing route
- [ ] 2.4 Add the Groceries tab screen with its SF Symbol icon (`cart` / `cart.fill`) and label
- [ ] 2.5 Add the Calendar tab screen with its SF Symbol icon (`calendar` / `calendar.circle.fill`) and label
- [ ] 2.6 Add the Profile tab screen with custom SF Symbol `person.crop.circle` (inactive) / `person.crop.circle.fill` (active) on iOS and an equivalent icon on Android using `Platform.select`
- [ ] 2.7 Remove the fifth search tab trigger (`NativeTabs.Trigger name="search" role="search"`) — no search slot in the tab bar
- [ ] 2.8 Preserve `tintColor` (accent), `tabBarActiveTintColor`, and inactive icon color theming from `useThemeColor`
- [ ] 2.9 Keep `SettingsSheetProvider` and `AppearanceSettingsSheet` wrapping the navigator as before

## 3. Implement `bottomAccessory` Search Bar on Recipes Tab

- [ ] 3.1 Create a `SearchAccessory` component (in `src/components/shell/` or similar) that renders a tappable search bar input styled to match the app theme — accepts a `placement` prop (`"regular"` | `"inline"`) and adapts layout accordingly
- [ ] 3.2 Wire `SearchAccessory` `onPress` to navigate to the `/search` route using `useRouter` from `expo-router`
- [ ] 3.3 Set `bottomAccessory` on the Recipes tab screen options to render `<SearchAccessory placement={placement} />`
- [ ] 3.4 Verify the search accessory renders above the tab bar in the regular (expanded) state and inline with the tab bar in the minimized state on an iOS 26 simulator/device

## 4. Update Spec File

- [ ] 4.1 Apply the delta changes from `openspec/changes/native-bottom-tab-navigation/specs/mobile-native-tabs-navigation/spec.md` into `openspec/specs/mobile-native-tabs-navigation/spec.md` — update the search requirement to reflect `bottomAccessory`, add the custom profile icon requirement, and remove the `role="search"` trigger requirement

## 5. Validation

- [ ] 5.1 Test on iOS 26 simulator: tab bar minimizes on scroll, search accessory appears in both placements, and tapping it navigates to the search screen
- [ ] 5.2 Test on iOS 18 or lower: tab bar always visible (no minimize), no crash from missing `bottomAccessory` (graceful degradation)
- [ ] 5.3 Test on Android: all four tabs render correctly with icons and labels, no crash
- [ ] 5.4 Verify deep linking and back navigation still work correctly with Expo Router screen files
- [ ] 5.5 Verify the `AppearanceSettingsSheet` (settings gear) still opens correctly from within the new navigator wrapper
