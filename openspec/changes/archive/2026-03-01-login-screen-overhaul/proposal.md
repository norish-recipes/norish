## Why

The mobile app's auth screens (connect, login, register) are visually inconsistent with the web version: they lack the brand logo, have centering/scrollbar layout issues, and show a black screen on launch. Users also have no way to change the backend server URL once the app is past the connect screen, and re-initializing BetterAuth after a URL change requires restarting the app.

## What Changes

- Replace the text-only "Norish" eyebrow label on all mobile auth screens with the brand logo SVG (`apps/web/public/logo.svg`, copied into mobile assets)
- Fix layout on all three mobile auth screens (connect, login, register) so content is properly centered without a scrollbar appearing when the keyboard is hidden
- Fix the screen that remains solid black at app launch and only renders correctly after the user minimizes and restores the window
- Add a "Change Server" option accessible from the login screen so users can return to the connect screen and enter a different backend URL
- Re-initialize the BetterAuth mobile client after a server URL change without requiring an app restart

## Capabilities

### New Capabilities

- `mobile-auth-server-url-change`: Ability to change the backend server URL from the login screen and have BetterAuth re-initialize against the new URL without restarting the app

### Modified Capabilities

- `mobile-auth-screens`: Visual and layout updates to connect, login, and register screens to match the web auth experience (logo, centering, no spurious scrollbar)
- `mobile-app-launch`: Fix black screen on initial app launch (splash/root screen rendering issue)

## Impact

- `apps/mobile/src/app/(auth)/login.tsx` — add "Change Server" button; consume re-initializable auth client
- `apps/mobile/src/app/(auth)/connect.tsx` — layout fixes, logo
- `apps/mobile/src/app/(auth)/register.tsx` — layout fixes, logo
- `apps/mobile/src/app/index.tsx` — investigate and fix black screen on launch
- `apps/mobile/src/lib/auth-client.ts` — support reactive re-initialization when base URL changes
- `apps/mobile/src/context/auth-context.tsx` — expose URL-change + re-init capability to screens
- `apps/mobile/assets/images/logo.svg` — copy of `apps/web/public/logo.svg`, used on auth screens
