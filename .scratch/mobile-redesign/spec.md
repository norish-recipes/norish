# Mobile redesign: the iPhone screens

Status: ready-for-agent

Settled in a `/grilling` session on 2026-11-12. The design is the "Norish iOS" canvas (https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz); each section of this spec names the boards it builds. Vocabulary is CONTEXT.md's Accounts & Sign-in section (**Server Address**, **Account**, **Sign-in Method**, **Sign-out**, **Session Expiry**). Target Version: 0.27.0-beta. Branch `feat/mobile-redesign`, cut from `refactor/app-structure`; it rebases onto rc once app-structure merges. Each area gets its tickets once the one before it has landed, as app-structure did: 01–06 are sign-in.

## Problem Statement

The mobile catch-up left the app working against the current server, but the only screens it has are the old sign-in forms in a card and a throwaway smoke screen. They don't match the canvas, they carry a language menu nobody designed, Register hard-codes an English password hint, and the version gate only runs when an address is typed, so an app updated past its saved server's version just fails later. Nothing animates, and errors are plain text.

## Solution

The sign-in area is rebuilt from the canvas, iPhone only, at compact width. The app opens on a splash that hands off to Server address, Sign in or the signed-in screen without a jump. The forms are vertically centred blocks with left labels, solid tinted actions and one inline error pattern that shakes once with a haptic. Glass appears only where iOS draws it on native components. The version gate also runs at launch and when the app returns to the foreground. The OAuth result, a failed provider sign-in and unreadable storage get their own status screens, and Sign-out lands back on Sign in.

## User Stories

1. As a household member, I want the app to open on Norish's splash and move straight to where I left off, so that launching feels like one motion.
2. As a household member setting up the app, I want to enter my Server Address with help one tap away, so that I know what to type.
3. As a household member, I want a mistyped address to tell me no Norish server answered, so that I can fix it.
4. As a household member, I want to sign in with whichever Sign-in Methods my server offers, and only those, so that I'm never shown a button that fails.
5. As a household member, I want a wrong password to tell me so in one line, so that I retry without reading a dialog.
6. As a household member, I want my password manager to fill the sign-in and sign-up forms, so that I don't type credentials.
7. As a household member, I want to create an account when my server allows sign-ups, with the password rule one tap away, so that my first try is accepted.
8. As a household member, I want to see which server I'm signing in to and change it from there, so that I can fix a wrong address.
9. As a household member, I want the app to tell me my server needs updating whenever it's too old, at launch too, so that I don't hit odd failures after an app update.
10. As a household member waiting on a server update, I want the app to move on by itself once the server is updated, so that I don't restart it.
11. As a household member, I want a provider sign-in that failed to say which provider and let me try again, so that I'm not stuck on an error.
12. As a household member, I want Sign-out to bring me back to Sign in for the same server, so that I can sign in as someone else.
13. As a household member using another language, I want every sign-in screen in my device's language, so that I can read it.
14. As a household member with Reduce Transparency or Reduce Motion on, I want the screens to respect it, so that they stay readable and calm.

## Implementation Decisions

### Scope and order

- iPhone only (`supportsTablet` stays off). Fold and iPad are a later regular-width pass.
- Sign-in comes first: Splash (Main, Launch), Server address (Connect), Sign in (Login), Sign up (Register), Update your server (UpdateServer), and three status screens: Signing in, Sign-in failed, Storage unavailable. Home, Recipe, Search, Groceries, Calendar and Settings follow, each specced when the one before it has landed.
- Sign-out's button stays on the smoke screen until Settings replaces it; its confirm stays the native iOS alert.

### Look

- Content uses heroui-native components styled with Uniwind classes; the per-screen `styles/*.styles.ts` files and `AuthShell`'s card go. Fields are heroui-native with labels left-aligned above them; the form block, not its text, is centred vertically.
- Glass follows Apple's 2026 guidance: only the control layer, only through native components, so iOS handles Reduce Transparency and its tint setting. The back button on Sign up is the native stack header's; the help popovers are `@expo/ui`'s SwiftUI `Popover`; the server chip is an `@expo/ui` SwiftUI `Button` with the glass style. `expo-glass-effect` is not added. Primary actions (Connect, Sign in, Create account, Try again) are solid tinted buttons, since they sit in the content layer.
- Help text lives behind a `?`/`i` button in a popover, never as a line under a field: the server example on Server address, the password rule on Sign up (`auth.signup.passwordDescription`, which replaces Register's hard-coded hint).
- The slogan is "Any recipe, any source.": the English `auth.login.subtitle` changes to the landing's order, the other locales follow, and web's login page shows the new wording too.
- The language menu (`auth-locale-menu`, `shell-menu`) goes; signed-out screens follow the device language, which iOS lets a person set per app.

### Motion

- Motion is part of each screen's ticket, built with Reanimated, and skipped or reduced to a fade under Reduce Motion.
- The native splash stays the logo alone (text in an image can't be translated). The JS first frame draws the logo at the native splash's exact position and fades the translated slogan in. Then, by boot phase: no Server Address, the logo and slogan glide up into Server address and the form rises in (the Launch board); a Server Address but no session, a cross-fade to Sign in; signed in, a fade to the signed-in screen.
- An error plays once: the field's border turns danger, the error line rises in, the field shakes, and an error haptic fires (`expo-haptics`, added through `expo install`). A status badge shakes once with one ring, and a tap replays it. Nothing loops.

### Errors

- One inline pattern on every form: a danger line under the form (or field) and a danger border, never an alert. Copy is terse and translated: "No Norish server answered at this address." (Server address), "Wrong email or password." (Sign in), "Sign-ups are closed on this server." (Sign up). Other failures use the existing `auth.errors.*` mapping in `auth-failure.ts`.

### Sign-in Methods

- Sign in shows exactly what `config.authProviders` reports: the password form when `passwordAuthEnabled`, a button per OAuth/OIDC provider, and the "or" divider only when both kinds are present. The "Sign up" link shows only when `registrationEnabled && passwordAuthEnabled`.
- Mobile never signs in automatically, even when one OAuth provider is the only method: a sign-in sheet thrown up at launch, cancelled, leaves an empty screen.
- Fields carry AutoFill content types (`username`, `password`, `newPassword`). A self-hosted server can't be an associated domain, so iOS offers saved passwords behind the key icon and never suggests a strong one; Sign up keeps its Confirm password field.

### Server Address and the version gate

- Code touched in these tickets moves to the glossary's name (`BackendBaseUrl…` → `ServerAddress…`); untouched code is not swept.
- The version check runs at Connect (as today), at each launch in the background against the saved Server Address, and on every return to the foreground while Update your server shows. Too old: Update your server. Unreachable: the check is skipped and the app carries on, Offline if it must; the check never blocks a launch. New enough while Update your server shows: the app continues to Sign in, saving the address if it wasn't saved yet.
- Update your server has no Retry and no back button: its server chip opens Server address.
- Changing the Server Address while signed in is a Sign-out first (the same unsynced-work confirm; cancelling keeps the session), then Server address opens pre-filled. The rule is recorded here; the Settings row that triggers it is built with Settings. While signed out, the chip on Sign in and Sign-in failed just opens Server address.

### Status screens

- Update your server, Signing in, Sign-in failed and Storage unavailable share one layout: an animated badge, a title, one line, at most one action, and the server chip where a Server Address is known.
- Signing in (`auth/callback`) is the splash with a spinner under the slogan and no action. Sign-in failed (`auth/error`) names the provider ("Google didn't sign you in."), offers Try again back to Sign in, and shows the chip. Storage unavailable offers Try again and no chip, and no longer prints the raw error (the log keeps it).

## Testing Decisions

- Each ticket runs the gates (`pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`) plus mobile's lint, typecheck, test and `expo export --platform ios`.
- Logic gets unit tests next to it: the launch and foreground version decisions (too old, new enough, unreachable) and the error-copy mapping. Screens are covered by Maestro, not unit tests.
- Existing testIDs (`connect-server-url`, `connect-submit`, `login-email`, `login-password`, `login-submit`, `update-server-description`, `smoke-sign-out`) are kept so the flows keep working while screens change.
- The Maestro flows are updated to the new screens and gain a Sign up flow; the whole set runs once, after the last ticket's review and fixes, and each new flow is run repeatedly to prove it is stable.

## Out of Scope

- Fold and iPad layouts, Android.
- Passkeys, magic links, password reset: the server offers none of them.
- The Settings screen and its Server row (the Server Address rule above is all that lands now).
- The remaining canvas areas, which get their own tickets later.
