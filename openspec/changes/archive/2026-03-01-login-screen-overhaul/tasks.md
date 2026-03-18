## 1. Logo Asset + Component

- [x] 1.1 Copy `apps/web/public/logo.svg` to `apps/mobile/assets/images/logo.svg`
- [x] 1.2 Verify `react-native-svg` and SVG transformer are configured in `apps/mobile/metro.config.js` (add `react-native-svg-transformer` config if missing)
- [x] 1.3 Create `apps/mobile/src/components/auth/auth-logo.tsx` that renders `logo.svg` via `react-native-svg` at a fixed width (e.g. 140 pt) with auto height
- [x] 1.4 Export `AuthLogo` from `apps/mobile/src/components/auth/index.ts` (create if needed)

## 2. Fix Auth Screen Layout (connect, login, register)

- [x] 2.1 Audit `apps/mobile/src/app/(auth)/connect.tsx` — replace `ScrollView` outer wrapper with `KeyboardAvoidingView` + inner `View` with `justifyContent: 'center'`; remove scroll indicator
- [x] 2.2 Audit `apps/mobile/src/app/(auth)/login.tsx` — same layout fix as 2.1
- [x] 2.3 Audit `apps/mobile/src/app/(auth)/register.tsx` — same layout fix as 2.1
- [x] 2.4 Replace text-only "Norish" eyebrow label in connect screen with `<AuthLogo />`
- [x] 2.5 Replace text-only "Norish" eyebrow label in login screen with `<AuthLogo />`
- [x] 2.6 Replace text-only "Norish" eyebrow label in register screen with `<AuthLogo />`

## 3. Fix Black Screen on App Launch

- [x] 3.1 In `apps/mobile/src/app/_layout.tsx`, confirm root wrapping `View` and `<Stack>` have `flex: 1` and an explicit non-black `backgroundColor` matching the theme
- [x] 3.2 Call `SplashScreen.preventAutoHideAsync()` at module level in `_layout.tsx` (before the component body)
- [x] 3.3 Call `SplashScreen.hideAsync()` once `useAuth().isLoaded` is true (in `_layout.tsx` or `auth-context.tsx`) so the splash covers the window until the first real frame is drawn
- [ ] 3.4 Test on device/simulator: confirm screen is not black on cold launch without needing to minimize/restore

## 4. Change Server from Login Screen

- [x] 4.1 Add a "Change server" `<Pressable>` link to `apps/mobile/src/app/(auth)/login.tsx`, displayed below the sign-in form
- [x] 4.2 On tap, navigate to `/connect` using `router.push('/connect')` (do NOT clear the saved URL — let the connect screen overwrite it on submit)
- [x] 4.3 Ensure the connect screen pre-populates its URL input with the currently saved backend URL when navigated to from login (it may already do this; verify)

## 5. Reactive BetterAuth Client Re-initialization

- [x] 5.1 In `apps/mobile/src/context/auth-context.tsx`, subscribe to `backend-base-url` changes using the existing `subscribe()` helper from `src/lib/network/backend-base-url.ts`
- [x] 5.2 On URL change, call `getAuthClient(newUrl)` and store the new client in a `useRef`; use a `useState` counter or state flag to trigger re-renders for consumers
- [x] 5.3 Ensure the auth session is invalidated (or treated as unknown) when the client is replaced, so `Stack.Protected` redirects to login for the new server
- [x] 5.4 Verify existing `AuthProvider` tests (if any) still pass after the subscription refactor; update as needed

## 7. Fix Splash White Flash

- [x] 7.1 Move `SplashScreen.hideAsync()` from `RootStack` up to `RootLayoutContent` so it can be gated on both `!isLoading` (auth) AND `hydrated` (appearance preference)
- [x] 7.2 Remove `backgroundColor: '#ffffff'` from `styles.root` in `_layout.tsx` (let the splash cover the window until both conditions are met)

## 8. Inline Heading Row (matching web)

- [x] 8.1 Update `AuthLogo` to accept an optional `inline` prop (or create a separate `AuthLogoInline` variant) that renders the SVG without the `alignSelf: 'flex-start'` wrapper, suitable for use inside a row `flexDirection: 'row'`
- [x] 8.2 Update `login.tsx` hero heading: replace stacked `<AuthLogo />` + `<Text>Sign in</Text>` with a single `flexDirection: 'row'` row containing `<Text>Sign in to </Text>` + `<AuthLogoInline />` (matching web's `"Sign in to <BrandLogo>"`)
- [x] 8.3 Apply same inline heading pattern to `connect.tsx` ("Connect to") and `register.tsx` ("Create account on")

## 9. Auth Screen Transitions

- [x] 9.1 ~~Change `(auth)/_layout.tsx` animation from `'fade_from_bottom'` to `'fade'`~~ Replaced with single-screen morph approach (see 12.x)

## 10. Provider Icons

- [x] 10.1 Create `apps/mobile/src/components/auth/provider-icon.tsx` — a `ProviderIcon` component that maps Iconify IDs (e.g. `"mdi:github"`, `"flat-color-icons:google"`) to `@expo/vector-icons` Ionicons names (`logo-github`, `logo-google`, etc.); unknown providers fall back to `MaterialCommunityIcons` `shield-account-outline`
- [x] 10.2 Export `ProviderIcon` from `apps/mobile/src/components/auth/index.ts`
- [x] 10.3 Use `<ProviderIcon>` in `login.tsx` OAuth provider buttons, passing `provider.icon` and a size of 20

## 11. OAuth Button Label Text Color

- [x] 11.1 In `login.tsx` `LoginForm`, add `style={{ color: foregroundColor }}` to the `<Button.Label>` inside OAuth provider buttons (currently defaults to muted/secondary gray)

## 12. Black Screen Fix (Comprehensive) + Auth Shell Morph Transitions

- [x] 12.1 Add `expo-system-ui` plugin to `app.json` with `backgroundColor: "#208AEF"` (matches splash) so native root view is never black
- [x] 12.2 Set `backgroundColor: SPLASH_BG` on `GestureHandlerRootView` and loading fallback views in `_layout.tsx`
- [x] 12.3 Create `apps/mobile/src/components/auth/auth-shell.tsx` — shared shell with heading row (text + inline logo), subtitle, Card wrapper, and footer. Card content uses Reanimated `FadeIn`/`FadeOut` layout animations.
- [x] 12.4 Export `AuthShell` from barrel `index.ts`
- [x] 12.5 Refactor `connect.tsx` to use `<AuthShell>` — removes duplicated layout/styles
- [x] 12.6 Refactor `login.tsx` to use `<AuthShell>` — removes duplicated layout/styles
- [x] 12.7 Refactor `register.tsx` to use `<AuthShell>` — removes duplicated layout/styles
- [x] 12.8 Change `(auth)/_layout.tsx` animation to `'none'` — shell renders identically on all screens, so no visible navigation; only card content fades in/out
- [x] 12.9 Run `tsc --noEmit` — zero type errors

## 6. Verification

- [ ] 6.1 Test connect → login flow: logo visible on both screens, no scrollbar, content centred
- [ ] 6.2 Test register screen: logo visible, no scrollbar, content centred
- [ ] 6.3 Test cold app launch: no black screen visible; splash dismisses directly to login or app shell
- [ ] 6.4 Test "Change server" flow: tap link → connect screen with old URL pre-filled → enter new URL → login screen uses new server
- [ ] 6.5 Test keyboard behaviour on all three auth screens (iOS + Android): no layout jump, content remains accessible
