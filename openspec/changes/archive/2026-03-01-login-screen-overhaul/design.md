## Context

The mobile app (Expo/React Native with Expo Router) has three auth screens: `connect`, `login`, and `register`. Currently these screens show only a text "Norish" label where the web app shows a full brand logo. The web app uses `apps/web/public/logo.svg` rendered via `<BrandLogo>` — this SVG needs to be copied into the mobile assets directory and rendered via `react-native-svg` (already a dep via Expo). The screens also have a layout defect — when the keyboard is not visible, a scrollbar appears and content is not centred. On app launch, the screen remains solid black; it only renders correctly after the user minimises and restores the window (a compositor/layout invalidation issue, not a splash-screen timing issue).

The backend URL is entered once on the `connect` screen and stored in `expo-secure-store`. Once past that screen there is no way to change it; the BetterAuth mobile client (`auth-client.ts`) is a factory function (`getAuthClient(baseUrl)`) that creates a new client instance, but the `AuthProvider` only calls it once at mount time.

## Goals / Non-Goals

**Goals:**

- Render `logo.svg` (copied from web) on all three auth screens (connect, login, register) in place of the text eyebrow
- Fix centering and eliminate the phantom scrollbar on all three screens
- Fix the screen that stays solid black on app launch until the user minimises/restores the window
- Add a "Change Server" button on the login screen that navigates back to `/connect`
- Re-initialize the BetterAuth client in `AuthProvider` whenever the backend URL changes, without an app restart

**Non-Goals:**

- Changing the web app's auth screens
- Redesigning the auth flow steps or adding new auth methods
- Altering BetterAuth server configuration
- Dark-mode logo inversion (already commented out on web; out of scope here)

## Decisions

### 1. Logo component: copy SVG + shared `AuthLogo` component

**Decision:** Copy `apps/web/public/logo.svg` to `apps/mobile/assets/images/logo.svg`. Create a small `AuthLogo` component in `apps/mobile/src/components/auth/` that renders the SVG via `react-native-svg` (using the `SvgUri` or inline transform approach — Expo's Metro is already configured for SVG via `@svgr/webpack` or the `react-native-svg-transformer` preset). Apply it in connect, login, and register screens to replace the text label.

**Alternative considered:** Use `logo-glow.png` (already in mobile assets). Rejected — the web uses `logo.svg` as the canonical brand asset; using a different raster image would create visual inconsistency between platforms.

**Alternative considered:** Inline the SVG markup directly in each screen. Rejected — duplicates the SVG source and makes future brand updates harder.

### 2. Layout fix: `KeyboardAvoidingView` + `ScrollView` removal

**Decision:** The scrollbar appears because each screen wraps content in `<ScrollView>` to handle keyboard avoidance, but the outer container is `flex: 1` with `justifyContent: 'center'` which causes the `ScrollView` content to overflow and show a scroll indicator even when the keyboard is hidden. Replace the outer `ScrollView` with `KeyboardAvoidingView` (behaviour `padding` on iOS, `height` on Android) wrapping a plain `View` with `justifyContent: 'center'`. The inner card content is short enough that true scrollability is not needed on any supported device size.

**Alternative considered:** Keep `ScrollView` but set `scrollEnabled={false}` and `contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}`. Rejected — `scrollEnabled={false}` still shows the scroll indicator on some Android versions and does not fully fix the centering on tall devices.

### 3. Black screen on launch: compositor invalidation, not splash timing

**Decision:** The symptom — screen stays black until minimize/restore — is a React Native compositor or layout invalidation issue, not a splash-screen sequencing problem. Minimize/restore triggers a window resize event that forces the compositor to re-draw. The most common causes are: (a) the root `View` has no measured dimensions at first render (missing `flex: 1` on the root), or (b) a `backgroundColor` of `'#000'` or `undefined` on the root Stack/Screen that is never painted over. The fix is: ensure the root `_layout.tsx` `<Stack>` (and any wrapping `View`) has `flex: 1` and an explicit non-black `backgroundColor` matching the app theme. Additionally, `SplashScreen.preventAutoHideAsync()` should be called and `SplashScreen.hideAsync()` gated behind auth state resolution — this ensures the splash covers the window while the first frame renders, eliminating the black frame regardless of the root cause.

**Alternative considered:** Add `backgroundColor` to the root Stack navigator only. Rejected — this masks but does not fix the layout measurement issue; the root view still may not paint on the first frame.

### 4. "Change Server" navigation: router push back to connect

**Decision:** On the login screen, add a small "Change server" `<Pressable>` link below the form. It clears the stored backend URL (`backend-base-url.ts` → `clear()`) and calls `router.replace('/connect')`. Clearing the URL ensures `index.tsx` and `AuthProvider` treat the app as unconfigured.

**Alternative considered:** Navigate without clearing the URL, letting the user overwrite it on the connect screen. Rejected — if the user cancels, the old URL should still be active, so instead keep the old URL and only clear + replace if the user submits a new one on the connect screen (which it already does via `save()`). Revised: do NOT clear on "Change server"; just navigate. The connect screen will overwrite if the user submits.

### 5. BetterAuth re-initialization: reactive client in AuthProvider

**Decision:** `getAuthClient(baseUrl)` already creates a fresh client per URL. The issue is `AuthProvider` only reads the URL once. Refactor `AuthProvider` to subscribe to `backend-base-url` changes (the module already exposes a `subscribe()` helper). When the URL changes, call `getAuthClient(newUrl)` and store the new client instance in a `useRef`; update a `useState` counter to trigger a re-render of consumers. Sessions are invalidated automatically because the new client has no session cookie for the new origin.

**Alternative considered:** Unmount and remount the entire `AuthProvider` subtree on URL change. Rejected — this would flash all screens and reset all component state. A client swap inside the provider is less disruptive.

## Risks / Trade-offs

- **Splash screen timing on Android:** `SplashScreen.hideAsync()` timing varies by device; too early causes a black frame, too late feels sluggish. Mitigation: hide as soon as `useAuth().isLoaded` is true, which is typically under 300 ms after JS boot.
- **SVG rendering on Android:** `react-native-svg` rendering of complex SVGs can be slow on first render on older Android devices. Mitigation: if the logo SVG is complex, provide a PNG fallback or simplify the SVG paths.
- **KeyboardAvoidingView on Android:** behaviour `height` can cause layout jumps. Mitigation: test on both platforms; use `Platform.OS === 'ios' ? 'padding' : 'height'`.
- **Auth client swap mid-session:** If a user is somehow authenticated and the URL is changed, the new client will have no session. This is the correct behaviour (they must re-authenticate against the new server), but the UX transition should be clean. Mitigation: clearing stored session data is handled by BetterAuth's Expo plugin on sign-out; since the URL change initiates a navigation to `/connect` → `/login`, the user will be prompted to log in again naturally.

## Open Questions

- Should the "Change server" action also sign the user out (clear BetterAuth session cookies/storage) before navigating? Currently the user is only navigated — if they return without changing the URL their session may still be valid. Likely yes, but needs product decision.
