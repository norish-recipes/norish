## Context

The app uses Expo Router for file-based routing with `NativeTabs` from `expo-router/unstable-native-tabs` as the tab bar. This abstraction wraps `@react-navigation/bottom-tabs` internally but exposes only a subset of the underlying API. Specifically, `bottomAccessory` (which allows rendering a custom view inline with the collapsed/minimized tab bar) is not exposed through the Expo Router abstraction. The `@react-navigation/bottom-tabs` package (v7.7.3) is already a direct dependency and ships `createNativeBottomTabNavigator` in its `unstable` sub-path export, which surfaces the full native tab bar feature set.

The three target features all come from `createNativeBottomTabNavigator`:

1. `tabBarMinimizeBehavior: "onScrollDown"` — tab bar hides on scroll down, reappears on scroll up (iOS 26+)
2. `bottomAccessory` — a render prop that injects a component into both the regular (expanded) and inline (collapsed) tab bar positions, used to embed a search bar on the home screen
3. `tabBarIcon` with a custom image/SF Symbol for the profile tab

Since Expo Router will continue to own the file-based screen routing, the migration is surgical: only the tab bar shell (`(tabs)/_layout.tsx`) changes. Screen files remain Expo Router screen components.

## Goals / Non-Goals

**Goals:**

- Replace `expo-router/unstable-native-tabs` `NativeTabs` with `createNativeBottomTabNavigator` from `@react-navigation/bottom-tabs/unstable`
- Enable `tabBarMinimizeBehavior: "onScrollDown"` for all tabs
- Render a `bottomAccessory` search bar on the Recipes (home) tab that taps through to the existing `/search` route
- Render a custom icon on the Profile tab (SF Symbol `person.crop.circle` on iOS, custom image on Android)
- Preserve the four existing tab destinations and their routes

**Non-Goals:**

- Changing the search screen itself (`(tabs)/search.tsx`) — only the entry point changes
- Adding new tabs or removing existing tabs
- Implementing a full profile avatar/photo — a custom SF Symbol icon is sufficient
- Supporting the `bottomAccessory` on non-home tabs
- Web platform support (this navigator is iOS/Android only; Expo Router's web rendering is unaffected since it doesn't use the native tab bar)

## Decisions

### Decision: Use `@react-navigation/bottom-tabs/unstable` directly rather than waiting for Expo Router exposure

**Rationale:** The `bottomAccessory` API is the core unlock for this change and is not surfaced through Expo Router's `NativeTabs`. The underlying package is already installed and versioned. Importing from the `unstable` sub-path is the same risk profile as the current `expo-router/unstable-native-tabs` — both are experimental. This avoids a dependency upgrade and ships the feature now.

**Alternative considered:** Wait for Expo Router to expose `bottomAccessory` in its `NativeTabs` API. Rejected: no timeline, blocks three requested features.

**Alternative considered:** Use `createBottomTabNavigator` (the stable JS-rendered version). Rejected: loses native platform rendering, no `bottomAccessory`, no `tabBarMinimizeBehavior`.

### Decision: Keep Expo Router for screen file routing; only replace the tab bar shell

**Rationale:** Expo Router's file-based routing (`(tabs)/recipes.tsx`, etc.) remains intact. The `createNativeBottomTabNavigator` wraps Expo Router's screen rendering by using the existing route components. This is the minimal-footprint approach — screen logic, deep linking, and layout files are untouched.

**Alternative considered:** Full migration away from Expo Router to plain React Navigation stack. Rejected: high blast radius, breaks deep linking and all other routing, no benefit for this change.

### Decision: Surface search via `bottomAccessory` on the Recipes tab only, removing the `role="search"` trigger

**Rationale:** The proposal specifies a dedicated search bar on the home screen using `bottomAccessory`. The existing `NativeTabs.Trigger name="search" role="search"` provided iOS's system search tab affordance but was a separate tab slot. With `bottomAccessory`, search is contextually anchored to the home (Recipes) screen, inline with the minimized tab bar — a more ergonomic placement. The search screen itself (`/search`) is still navigated to when the user activates the search bar.

**Alternative considered:** Keep both the `role="search"` tab trigger and add `bottomAccessory`. Rejected: redundant entry points; the system search tab occupies a slot in the 5-tab limit on Android.

### Decision: Profile tab icon uses `tabBarIcon` with SF Symbol `person.crop.circle` (iOS) and a local image (Android)

**Rationale:** `tabBarIcon` accepts an object or function, with `type: 'sfSymbol'` on iOS and `type: 'image'` on Android. `person.crop.circle` / `person.crop.circle.fill` is the standard iOS system symbol for a profile/account — visually distinct from the generic `person` icon and communicates "my account" clearly. On Android a Material icon drawable is used via `{ uri: 'icon_name' }`.

**Alternative considered:** Render a live user avatar image as the tab icon. Rejected: live images require async loading in tab bar options, no clean API for dynamic image sources in this navigator version, and the spec only requires a custom icon.

## Risks / Trade-offs

- **`@react-navigation/bottom-tabs/unstable` is experimental** → The API may change in future releases. Mitigation: the `unstable` export is explicitly documented and the features targeted (`bottomAccessory`, `tabBarMinimizeBehavior`) are highlighted in official docs. Expo Router's own `NativeTabs` carries the same risk.

- **`bottomAccessory` only renders on iOS 26+** → On earlier iOS and Android, the accessory is not displayed. Mitigation: search remains accessible via the profile screen or as a future header button. The spec and design explicitly scope this as an iOS 26+ enhancement.

- **`tabBarMinimizeBehavior` only works on iOS 26+** → On lower iOS versions the tab bar remains always visible. This matches current behavior and is acceptable.

- **`createNativeBottomTabNavigator` requires React Native 0.79+ and Expo SDK 53+** → The `package.json` already targets SDK 53 / RN 0.79. No version upgrade needed.

- **Expo Router deep linking and URL handling** → Replacing the tab bar shell with a React Navigation navigator does not affect Expo Router's link resolution since screen components are unchanged. However, if Expo Router's tab bar performs any internal state injection (e.g., active tab highlighting tied to its router), this may need to be reconciled. Mitigation: validate tab highlighting and navigation state after migration in dev build.

## Migration Plan

1. Update `(tabs)/_layout.tsx`: replace `NativeTabs` import and JSX with `createNativeBottomTabNavigator` setup, configuring all four tabs with equivalent icons and labels, adding `tabBarMinimizeBehavior`, `bottomAccessory` on the Recipes screen, and the custom profile icon.
2. Remove the search tab trigger (the fifth `NativeTabs.Trigger`) — search is now surfaced via `bottomAccessory`.
3. Update `openspec/specs/mobile-native-tabs-navigation/spec.md` to reflect the changed search entry point and new `bottomAccessory` capability.
4. Test in an Expo development build on iOS 26 simulator (or device) for `bottomAccessory` and `tabBarMinimizeBehavior`. Test on iOS 18 and Android for graceful degradation.
5. No data migration or backend changes required.

**Rollback:** Revert `(tabs)/_layout.tsx` to the `NativeTabs` version. Single-file rollback.

## Open Questions

- Should the `bottomAccessory` search bar appear on tabs other than Recipes (e.g., Groceries) or strictly on the home tab? Current decision: Recipes only. Revisit if UX feedback suggests broader placement.
- Android: `tabBarMinimizeBehavior` is iOS-only. Should Android use `labelVisibilityMode: "selected"` or another space-saving mechanism? For now, no Android-specific tab bar behavior change is scoped.
