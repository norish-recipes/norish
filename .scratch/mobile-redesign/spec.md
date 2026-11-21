# Mobile redesign: the iPhone screens

Status: sign-in tickets 01-06 done; Recipes tab tickets 07-17 open; Recipe, Groceries and Calendar tickets 18-30 open

Settled in a `/grilling` session on 2026-11-12. The design is the "Norish iOS" canvas (https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz); each section of this spec names the boards it builds. Vocabulary is CONTEXT.md's Accounts & Sign-in section (**Server Address**, **Account**, **Sign-in Method**, **Sign-out**, **Session Expiry**). Target Version: 0.27.0-beta. Branch `feat/mobile-redesign`, cut from `refactor/app-structure`; it rebases onto rc once app-structure merges. Each area got its tickets once the one before it had landed, as app-structure did: 01–06 are sign-in, 07–17 the Recipes tab (Part 2 below). Recipe, Groceries and Calendar were specced together on 2026-11-14 as Parts 3–5, tickets 18–30. Search is specced on its own in `.scratch/mobile-search/spec.md`.

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

---

# Part 2: the Recipes tab

Settled in a `/grilling` session on 2026-11-13. The tab carries web's label for its dashboard, **Recipes** (`navbar.nav.home`): Today on top, the **Library** below (CONTEXT.md's Library & Cookbooks section). The boards are the Home row of the canvas plus the ones ticket 07 adds.

## Problem Statement

Signed in, the app shows a smoke screen. A household member can't see their recipes, today's meals or their cookbooks, can't plan, add to groceries or import, and can't send a recipe to Norish from another app. Web has all of it, and most of its logic already sits in `packages/shared-react`; the rest is web-only glue that mobile would otherwise copy.

## Solution

The signed-in shell is built with native tabs and the "Add recipe" accessory, and its first real tab is Recipes: Today's four slots over the Library in list or grid, with filters, swipe and context-menu actions on every card, cookbooks, planning, adding to groceries and imports. A Share Extension imports a link, text or photos from any app without opening Norish. Every ticket first moves the web-only logic it needs into shared-react, so the mobile screens add only UI.

## User Stories

1. As a household member, I want to see today's meals at the top of Recipes, opened on the next meal, so that I know what's cooking.
2. As a household member, I want to plan an empty slot of today from a recipe search, a random pick or a note, so that today gets filled in place.
3. As a household member, I want to move or remove a planned item from today, so that a changed plan is two taps.
4. As a household member, I want to browse my Library in a list or a grid, remembered on this device, so that it looks how I like it.
5. As a household member, I want to filter the Library like on web, kept across launches, so that I find what fits tonight.
6. As a household member, I want to swipe or long-press any card to plan it, add it to groceries, favourite it, add it to a cookbook or delete it, so that I act without opening it.
7. As a household member, I want to plan a recipe on any day from last month to next month, so that I plan ahead.
8. As a household member, I want to add a recipe's ingredients to groceries with servings scaled and pantry staples left off, so that the list is right.
9. As a household member, I want to make, rename, fill, cover and delete cookbooks, so that I keep my collections on the phone too.
10. As a household member, I want Add recipe to offer the link I just copied, so that importing takes one tap.
11. As a household member, I want to import from a link, pasted text or photos, so that any source works.
12. As a household member, I want to share a link, text or photos to Norish from any app and see it confirmed, so that I never leave the app I'm in.
13. As a household member, I want imports, plans and deletes made offline to happen once I'm back, so that the app works in the kitchen without signal.

## Implementation Decisions

### Scope and order

- Ticket 07 is a canvas session (Mike) that draws what the Home row lacks: an opened cookbook; Today with nothing planned and with all slots full; the Add recipe sheet with the copied-link row; From link, From text and From photos; the Plan this recipe sheet; the Filters sheet on Recipes; the Library empty and with no results; the Share Extension's states. Tickets 08–17 build against those boards.
- The shell comes with this area. The tabs are Recipes, Groceries, Calendar and Settings, plus the separate Search tab; the last four are placeholders until their areas. Sign out moves to the Settings placeholder and the smoke screen goes.
- A recipe tap opens a bare `/recipe/[id]` route (photo and name) that the Recipe area replaces. "Write it yourself" is on the Add recipe sheet and leads to a placeholder, as the editor belongs to the Recipe area.

### Shared logic first

- Each ticket starts by moving the logic it needs from `apps/web` into shared-react, as hooks or pure helpers with their unit tests, and switches web to them in separate commits (CONTRIBUTING "App architecture"). Platform-bound code stays on its platform: web's PDF page splitting, the filter cookie that seeds the server render, the browser clipboard helper.
- Mobile's platform adapter implements `toast` (heroui-native) and `navigation.toRecipe`, and the shell mounts what web's shell mounts (`useRecipeOutcomesSubscription`, the config subscription, the library, ratings, cookbooks, pantry and calendar subscriptions).
- `importRecipeFromImages` and `uploadCookbookImage` accept mobile's `expo-file-system` files as well as web's `File`/`Blob`.

### Today

- As on web: the four slots Breakfast to Snack, opened on the next meal for the hour, shown per the `todaySectionVisibility` device preference. Filled slots are photo cards (notes included), empty ones an add card that opens the board's Plan a recipe sheet for today and that slot (slot tabs, recipe search, Random recipe, note).
- Long-press opens the native context menu: Open recipe, Move… (the Plan this recipe sheet), Remove. Remove confirms with the native alert.

### Library

- All / Recipes / Cookbooks, list or grid per the `recipeViewMode` device preference, running imports as pending cards first (not under Cookbooks), the web empty and no-results states. No search field: the Search tab owns search.
- The Filters button opens the Filters sheet with web's filters minus "Search in", on `LibraryFiltersProvider`, persisted on the device through platform storage. No floating result-count pill.

### Card actions

- Both views swipe (Groceries, Plan, Delete) and long-press into the native context menu: Favourite/Unfavourite, Groceries, Plan, Add to cookbook, Delete, and Remove from cookbook inside a cookbook. Delete shows only when permitted and confirms with the native alert. Double-tapping the photo toggles Favourite with a light haptic; the heart shows only on favourites. No multi-select.
- Cookbook cards get the same pattern: Add recipes, Rename, Delete.

### Planning and groceries

- Plan this recipe (from a card, and Move… from Today) is web's mini calendar: days from last month to next month, opened on today, each day card showing what's planned with an add per slot. Its day card is the component the Calendar area reuses.
- Both plan sheets follow the "after planning" preference: nothing, open Add to groceries, or add at once.
- Add to groceries is web's mini-groceries: servings stepper, to buy / in your pantry, "we keep this", add.

### Cookbooks

- Opening a cookbook shows the Library scoped to it under its cover and title. Create (from "+" and from a card's Add to cookbook), rename, delete, add recipes (picker sheet), remove from cookbook, upload a cover (off while offline, as on web).

### Add recipe and imports

- The accessory opens the Add recipe sheet: From a link, From photos (only when AI is on), From text, Write it yourself.
- When the sheet opens, `expo-clipboard`'s `hasUrlAsync()` checks for a link; if there is one it is read (iOS's paste prompt is accepted) and shown as the first row, "Import ‹host›", which imports in one tap; From a link opens pre-filled with it. Links to the own server are skipped. There is no app-wide copied-link ask.
- From photos takes several images from the library or the camera. PDFs are deferred: the server takes only JPEG, PNG and WebP, and web splits PDFs in the browser.
- Imports show the pending card; a finished one a toast with View, a failed one a toast with the reason, on every tab.

### Share Extension

- A SwiftUI Share Extension (not React Native: extensions get about 120 MB) accepts links, text and images and calls `importFromUrl`, `importFromPaste` or `importFromImages` itself, shows a confirmation and closes. Implemented on Opus at high effort: it moves the session.
- The Server Address and the session cookie reach it through an App Group and a shared keychain access group; Better Auth's SecureStore items move into that group once on upgrade.
- Unreachable: it saves the item in the App Group and says Norish will import it when the server is reachable; the app drains saved items into the Outbox on foreground. Signed out or no Server Address, a too-old server, images with AI off, any other failure: one translated line and Close, no retry.
- Its strings are generated from `packages/i18n` at prebuild.

### Loading and sheets

- Every data-backed view paints in its first frame: the cached Warm Set data when there is any, otherwise a skeleton shaped like the content. The splash and the screens never wait on a data round trip.
- Sheets are the native sheet's glass and nothing on them paints a background of its own: pinned actions sit directly on the sheet, with the scroll area ending above them. No solid footers.
- A sheet whose content does not fit at once has two detents, 62% of the screen and full height, opens at 62% with a grabber, and expands to full when dragged or when its list is scrolled. A sheet whose content fits is as tall as its content and does not resize. Sheet heights do not follow the boards.
- Every sheet is built from one shared sheet: one set of route options (form sheet, grabber, detents, transparent content) and one layout component that places the title, subtitle and close button, the scrolling body and the pinned actions. A screen supplies content only; no sheet sets its own height or button placement.
- Photos are proven to load on the device (cards, covers, the recipe route), signed in against a server that requires the session.

### Offline

- As web: Recipes reads from the Warm Set, and every write, imports included, goes through the Outbox.

## Testing Decisions

- Gates per ticket as in Part 1. Moved logic keeps or gains unit tests next to it in shared-react; web's E2E stays green after each move.
- Maestro flows: browse and filter, plan from Today, plan from a card, add to groceries, cookbook create and add, import from a link, delete, Recipes offline. They run once after the last ticket's review, each new flow repeatedly.
- The Share Extension is checked by hand on a device; its App Group drain gets a unit test.

## Out of Scope

- The Recipe screen and the recipe editor (stubs only), Search, Groceries, Calendar and Settings beyond placeholders.
- PDF import on mobile, multi-select, an app-wide copied-link ask.
- Fold, iPad, Android.

---

# Part 3: the Recipe screen, cook mode and the Live Activity

Settled in a `/grilling` session on 2026-11-14, together with Parts 4 and 5. Vocabulary is CONTEXT.md's Recipes section, including the new **Recipe Timer**. The boards are the Recipe row (Recipe, RecipeSteps with its `part`/`overlay` tweaks, CookMode, RecipeEdit) plus what ticket 18 adds. Build order is Recipe, then Groceries, then Calendar, after ticket 17 has closed the Recipes tab.

## Problem Statement

A card on Recipes opens a stub with a photo and a name. A household member can't read a recipe on the phone, scale it, cook from it, set its timers or edit it, and a timer started on the phone would die with the screen, out of sight once the phone is locked.

## Solution

The Recipe screen is built from the canvas with everything web's recipe page offers a reader on a phone, cook mode follows web's cooking mode, and the editor replaces the "Write it yourself" placeholder. Recipe Timers move into shared-react, keep running when the app is closed, ring through a local notification and show on the Lock Screen and in the Dynamic Island as one Live Activity.

## User Stories

1. As a household member, I want to read a recipe on my phone in the order the canvas sets (Notes, Ingredients, Steps, rating, cookbooks, Nutrition, Provenance, Source), so that it reads like web.
2. As a household member, I want to change the servings and switch metric/imperial, so that amounts fit what I'm cooking.
3. As a household member, I want to favourite, rate, share, plan, add to groceries, run AI actions on and delete a recipe from its screen, so that I don't need web for it.
4. As a household member, I want to page through a recipe's photos and play its video, so that I see what I'm making.
5. As a household member, I want cook mode to walk me through the steps with the ingredients one swipe away and keep the screen awake, so that I cook with dirty hands.
6. As a household member, I want to start a timer from a step on the recipe or in cook mode, so that I time what the step says.
7. As a household member, I want my timers to keep running and ring when the app is closed or the phone is locked, so that nothing burns.
8. As a household member, I want my running timers on the Lock Screen and in the Dynamic Island, so that I see them without unlocking.
9. As a household member, I want tapping a timer's Live Activity or notification to open cook mode on that step, so that I carry on where the timer was.
10. As a household member, I want to write and edit a recipe on my phone, so that a recipe from a card or a relative gets in.

## Implementation Decisions

### Scope and order

- Ticket 18 is one canvas session (Mike) for all three areas, drawing only what the canvas lacks: Calendar empty and offline; Recipe Timer chips on the Recipe page; the Live Activity on the Lock Screen and in the Dynamic Island (compact, minimal, expanded) and its timer-done state; the small calendar widget filled, with a note and with nothing planned; the week widget; the widgets' signed-out state; every widget in light, dark, tinted and clear.
- Recipe covers the page, its sheets (servings, share, AI, delete), media, cook mode and the editor. Print is web-only. Search and Settings stay out.

### Shared logic first

- As in Part 2, each ticket moves the web-only logic it needs into shared-react with its unit tests and switches web in separate commits: the conversion, amount-display and unsaved-navigation-guard hooks, and the timers store.

### Recipe screen

- Parity with web's recipe page as the RecipeSteps board orders it, Hidden Items respected. AI actions show only when AI is on and the reader may run them, as on web.

### Cook mode

- Web's cooking mode as the CookMode board draws it: faded previous/next steps, ingredient chips, progress and Ready At, steps and ingredients views. The screen stays awake while it is open.

### Recipe Timers

- `apps/web/lib/timers.ts` moves to shared-react with platform storage, so timers keep web's states (running, paused, done), adjust, reset and drift correction, and survive the app closing. Timer chips show on the Recipe page's steps and in cook mode. The clock pill in cook mode opens the timer list (canvas v69).
- A Recipe Timer is not part of the Cooking Session (CONTEXT.md): closing cook mode leaves its timers running.
- When a timer starts, a local notification is scheduled for its end (`expo-notifications`, added through `expo install`), and cancelled on pause, reset or removal. Notification permission is asked the first time a timer starts, never at launch. Tapping the notification opens cook mode on the timer's step.
- Hiding recipe timers (a Hidden Item) removes the chips, so no timer, notification or Live Activity ever starts.

### Live Activity

- One Live Activity for every Recipe Timer on the device, whichever recipe started it. It starts with the first timer and ends when none is left; when the last one finishes it ends showing Done and iOS clears it.
- Lock Screen: up to three timers, soonest first, each with its recipe and step label and a countdown or "Paused", then "+N". Dynamic Island compact shows the soonest countdown, minimal a ring, expanded the Lock Screen's rows.
- Countdowns tick on their own (`timerInterval`), so the app only updates the activity when a timer starts, pauses, resets, is adjusted or finishes. No buttons; a tap opens cook mode on the soonest timer's step.
- Built with `expo-widgets` (Expo's SDK 58 package, JSX with `@expo/ui` SwiftUI components), not as Swift in an `@bacons/apple-targets` target: the app pushes everything a widget or activity shows, which is what `expo-widgets` does. Its extension sits next to the Share Extension's target; the Live Activity ticket starts by proving the two build and run side by side (prebuild, simulator), with SwiftUI through apple-targets as the fallback if they don't.

### Editor

- The RecipeEdit board: full screen, glass close top-left, Save or Create as a full-width pill at the bottom, cards like the page, Notes above Ingredients, a row per ingredient with a grip, `#` sections, the `@` ingredient popup in steps. Leaving with changes asks through the native alert.

### Offline

- As Part 2: the recipe reads from the Warm Set and every write goes through the Outbox.

## Testing Decisions

- Gates per ticket as in Part 1. Moved logic keeps or gains unit tests in shared-react; web's E2E stays green after each move. The Live Activity's pushed state (which timers, order, "+N") is built by a pure function with unit tests.
- Maestro flows: read a recipe and scale it, cook mode through a recipe with a timer, edit and save, create from Write it yourself. The Live Activity and the timer notification are checked by hand on a device, locked and with the app closed.

## Out of Scope

- Live Activity buttons (pause, +1 min, stop), timers shared across devices or the household, printing.

---

# Part 4: Groceries

The Groceries row of the canvas (the list's `view` and `overlay` tweaks, the add and edit sheets, Repeat, Pantry, Manage stores, the store editor, product search). Vocabulary is CONTEXT.md's Groceries & Stores section.

## Problem Statement

On mobile, Add to groceries writes to a list nobody can see. A household member can't shop from the phone, tick lines off, sort them into stores and aisles, manage the pantry or the stores, or see prices.

## Solution

The Groceries tab is built from the canvas at parity with web, drag included: lines reorder within a Store, move between Stores, file into an Aisle, and Stores and Aisles reorder in Manage stores. Web's drop logic moves to shared-react so both apps resolve a drop the same way.

## User Stories

1. As a household member, I want the household's list grouped by Store and Aisle, or by recipe, so that I shop in the order I walk.
2. As a household member, I want to tick a line off with one tap, so that I shop with one hand.
3. As a household member, I want to add items with a store and a repeat, typed in plain words, so that weekly staples come back on their own.
4. As a household member, I want to drag a line to another place, Store or Aisle, so that the list matches the shop; a line filed into an Aisle lands there next time.
5. As a household member, I want to edit a line's store product, price, store, aisle and repeat, so that the price is right.
6. As a household member, I want to clear done lines or the whole list, so that next week starts clean.
7. As a household member, I want to manage my pantry, so that staples are left off what I buy.
8. As a household member, I want to add, edit, colour, reorder and delete Stores and their Aisles, so that the list follows the shops I use.
9. As a household member, I want groceries I tick or add offline to sync once I'm back, so that the list works in a shop without signal.

## Implementation Decisions

### Scope and order

- Groceries covers the list (store, recipe and grouped views, empty), ticking, the "Add items" accessory and its sheet, the edit sheet, Repeat with its plain-words detection, clearing, Pantry, Manage stores with the store editor and delete, and Store Product search and prices. Ingredient management stays off mobile.

### Gestures

- On Groceries and the Calendar tab, holding a row lifts it and dragging moves it; a tap opens its sheet (the grocery edit sheet here), the checkbox ticks. Neither tab has a long-press context menu, because the native menu (`Link.Menu`) would claim the hold. Recipes cards keep theirs.

### The drag list

- One drag list shared by Groceries, Manage stores and the Calendar tab, built before either area: a flat list whose headings (Store, Aisle, day) are non-draggable rows, a drop resolved by the heading above it, a haptic on lift and drop, auto-scroll near the edges, a Reduce Motion fallback. Its ticket first checks `react-native-reorderable-list` on RN 0.88 / Reanimated 4.7 with headings as rows, and builds on Gesture Handler and Reanimated if it falls short.

### Grocery drag

- Full parity with web's drop plan (`dnd/drop-plan.ts`, `use-list-dnd.ts`), which moves to shared-react: reorder within a Store, move to another Store or Unsorted, drop under an Aisle heading to file the name there (an Aisle Link), a grouped line moves as one, in store view and recipe view.

### Stores

- Manage stores reorders Stores and each Store's Aisles by drag, as web's store manager does.

### Offline

- The list reads from the Warm Set; ticks, adds, edits and drops go through the Outbox.

## Testing Decisions

- Gates per ticket. The moved drop plan keeps its unit tests in shared-react; web's E2E stays green.
- Maestro flows: add an item with a repeat, tick and clear, drag across Stores and into an Aisle, manage a Store, pantry, Groceries offline. The grocery realtime check that Part 2 deferred returns here.

## Out of Scope

- A groceries widget (dropped for now), ingredient management on mobile.

---

# Part 5: Calendar and the calendar widgets

The Calendar row of the canvas plus ticket 18's empty, offline and widget boards. The day card is Part 2's.

## Problem Statement

The Calendar tab is a placeholder. A household member can plan from a card or from Today but can't see the weeks around today, move a meal to another day, or glance at what's for dinner without opening the app.

## Solution

The Calendar tab is web's timeline of day cards with the "Plan recipe" accessory, drag between days and the planned-item and add-to-day sheets. Two Home Screen widgets show the current planned meal and the coming seven days from data the app hands them.

## User Stories

1. As a household member, I want the days around today with what's planned in each slot, opened on today, so that I see the plan at a glance.
2. As a household member, I want to drag a planned meal to another day, so that a shifted evening is one move.
3. As a household member, I want to tap a planned item to open its recipe, add it to groceries, change its date or slot, or remove it, so that a plan is easy to fix.
4. As a household member, I want to plan a recipe or a note on any day from the accessory, so that planning ahead is quick.
5. As a household member, I want a small widget showing the meal for this part of the day, so that I know what's next without opening Norish.
6. As a household member, I want a large widget with the next seven days, so that I see the week from the Home Screen.

## Implementation Decisions

### Calendar tab

- Web's timeline: day cards from two weeks back to two weeks ahead, growing at either edge, opened on today with a way back to it; Today ringed. The "Plan recipe" accessory opens the plan sheet (add sheet plus a day picker). CalDAV is parked.
- A tap on a planned item opens the planned-item sheet (date, slot, go to recipe, add to groceries, remove); an add on a day opens add-to-day.

### Drag

- Hold and drag as in Part 4, on the shared drag list. Web's rule (`use-calendar-dnd.ts`), moved to shared-react: an item dropped on another day keeps its slot and lands last in it; the list auto-scrolls near the edges and does not grow while dragging. Changing the slot stays in the sheet.

### Widgets

- Two widgets with `expo-widgets`, on the setup the Live Activity ticket proved. Small: the current planned meal; large: the next seven days. No medium size, no month.
- Small follows Today's rule (`nextMealSlot`: Breakfast before 10:00, Lunch before 14:00, then Dinner). An empty slot falls forward to the next filled slot later today, never into tomorrow; with nothing left today it shows "Nothing planned" and opens Today. A recipe shows its photo full-bleed with the slot and name and opens the recipe; a note shows its text and opens Calendar on that day.
- Large: today and the six days after it, a row per day with its planned items by slot, today ringed. A planned recipe opens it; a note or a day's empty space opens Calendar on that day; the header opens Calendar on today.
- **Push only.** The widgets never talk to the server: the app hands them their data whenever it runs, at launch, on foreground and on every calendar change it sees, realtime included, and writes the photos they show into the shared folder. A change made by someone else while Norish isn't running shows only after the app next runs. This is a known constraint that the docs state. A widget fetching for itself (session readable after first unlock) can come later without changing the boards.
- Each push hands over today and the next 13 days as timeline entries at midnight and at the 10:00 and 14:00 slot changes, so the widgets roll on their own for two weeks. Beyond that, and after Sign-out, which clears their data, they show one line: "Open Norish to sign in" when signed out, "Open Norish" when the data has run out.

### Offline

- The tab reads from the Warm Set; plans, moves and removes go through the Outbox. The widgets show what they were last handed.

## Testing Decisions

- Gates per ticket. The moved drop rule keeps its unit tests; the widgets' entry builder (which meal, fall-forward, the 14-day horizon, the slot-change entries) is a pure function with unit tests.
- Maestro flows: plan from the accessory, drag to another day, open and remove from the sheet, Calendar offline. The widgets are checked by hand on a device in light, dark, tinted and clear.
- The docs page for the widgets states that they update when Norish runs.

## Out of Scope

- CalDAV on mobile, a month view, a medium widget, widgets that fetch for themselves, Android.

# Part 6: Refinement

Settled in a `/grilling` session on 2026-11-15, after using Parts 1–5 on a device. Nothing here changes CONTEXT.md's vocabulary.

## Problem Statement

The screens work but don't feel native or finished. The Recipe page and every sheet draw their own bars and buttons, motion is mostly a plain fade, timers can't be handled outside cook mode, loaders are mixed and off-centre, and a list of small faults (swipe rows scrolling the list, clipped focus rings, a fullscreen button that does nothing, a planned-item sheet that saves on every change) adds up.

## Solution

Native iOS navigation everywhere a screen has a counterpart, motion that follows the finger and springs, one rule for the bottom accessory, and each listed fault fixed in its area's ticket.

## Implementation Decisions

### Rules

- **Native first.** Native headers, toolbars and sheet headers wherever iOS has them. Two exceptions keep their canvas design: the tab roots' TitleRow (Recipes, Groceries, Pantry, Calendar) and cook mode's full-screen chrome. Controls in a TitleRow sit in glass.
- **Accessory rule.** The bottom accessory is the tab's one add action, labelled for what's on screen: Add recipe or Add cookbook on Recipes, Cook on a recipe, Add items or Add to pantry on Groceries, Plan recipe on Calendar. No duplicate plus buttons in headers. Calendar's per-day "+" stays because it carries a date. While any Recipe Timer exists, the accessory also holds the timer: its ring and countdown on the accessory's own glass, no fill of its own. The action keeps its label beside the timer wherever it fits, minimised too, and falls back to its icon only when it does not.
- **Motion.** Springs instead of timed eases; gestures follow the finger and are interruptible; haptics where something changes; Reduce Motion gets fades or nothing. Web's micro-animations (the inventory below) are the floor, not the target. Motion lives in each area's ticket.
- **Loaders.** One shared loader on the native iOS activity indicator that centres itself, in a list above the tab bar and accessory. A skeleton wherever the data's shape is known.

### Web's motion, the floor

Rolling digits for servings, ingredient amounts, nutrition and portions (`components/shared/rolling-text.tsx`); step number → check scale-swap; ingredient check fade and strike; the double-tap heart pop; the selection bar sliding up; sections and rows animating in, out and on reorder; chevron rotations; the timer dock morphing into its list; a removed item animating out.

### Recipe Timers outside cook mode

- The capsule in the accessory shows the soonest countdown and a ring and opens the timer list as a sheet (pause/resume, ±, reset, remove). With no timers the accessory shows its add action alone.
- A long press on a timer chip opens Reset and Remove. A tap stays start, pause or resume.

### Recipe page

- Back and actions stay native header items, pinned while scrolling, with no scroll-edge title bar. The recipe page keeps the native tab bar, and its bottom accessory reads Cook and opens cook mode, minimising on scroll as on every tab (Mike, 2026-11-16, final: a Home and Cook toolbar and floating glass controls were both tried and dropped). The accessory's label cross-fades when a recipe is pushed or popped. `recipe-bottom-bar.tsx` goes and there is no Home button. Cook mode, the editor and the media viewer hide the tab bar; cook mode keeps its own bar, whose timer pill morphs into its list.
- The servings and portion steppers are glass, like the conversion menu. The calorie card matches the canvas.
- A tap on the hero opens a full-screen viewer of every image and video, from the one tapped: pinch zoom, swipe down to dismiss, "n / m". The video fullscreen button works.
- Server images (icons, photos, avatars) load through `expo-image` with its memory and disk cache; a recipe's icons are prefetched as the page opens. A food with no icon shows nothing: an empty slot of the icon's width only when another row in that list has an icon, otherwise no slot.

### Cook mode

- The vertical step column follows the finger: the next peek rises into the centre and grows to full size while the current shrinks into the upper peek; release springs with the gesture's velocity; a light haptic per step. Prev/next and peek taps run the same spring. Steps ↔ Ingredients crossfade-slide.

### Sheets and the editor

- Every sheet uses the native sheet header: system title, native glass close, Save as a confirm item where the sheet saves. The recipe editor gets a native header with Close and Save. Hand-built titles, `GlassCloseButton` and the extra back buttons go. Content height changes animate.

### Recipes tab

- The accessory reads Add cookbook while the library shows Cookbooks; the library's own plus button goes. The avatar sits in glass.
- The Recipes/Cookbooks and grid/list toggles animate their selection with a haptic; the heading word rolls. The content underneath swaps without a morph.
- Grid cards show every tag, allergens first, in a row that scrolls sideways, as web's.
- Opening a swipe row never scrolls the list; an open row closes on scroll or a tap anywhere else.

### Groceries

- The add and edit sheet keeps its own height when the keyboard opens and rides up on it. The field's focus ring is not clipped.
- On Pantry the accessory reads Add to pantry and opens a sheet that searches existing Ingredients, adding one of them or a custom entry. The Pantry's top field only filters.
- A checked item springs into Done; drag has pickup and drop haptics.

### Calendar

- The planned-item sheet is a draft: date, slot and note commit on Save; Cancel or swipe down discards. Remove asks to confirm, then the item animates out.
- One move UI, the plan sheet's 14-day strip plus its date picker, then the slot tabs, for Move from Today and Calendar's planned-item sheet. Calendar's Add gets the same strip. The day-cards list stays only for planning a recipe from the recipe.

### Loading

- The shared loader replaces every `ActivityIndicator` and `Spinner`; the library's load-more footer is centred. While a session restores at launch, the splash logo stays until the shell or Sign in is ready, with the loader under it only after about a second.

## Testing Decisions

- Gates per ticket. Logic that moves or is new (the move UI's draft, the accessory's label, the icon slot rule) gets unit tests. Existing Maestro flows stay green and are updated where a hand-built button became native; new flows: stop a timer from the accessory, the planned-item draft and Save, add to pantry from the sheet. Motion and haptics are checked by hand on the simulator and a device.

## Out of Scope

- A canvas audit, a Connecting-to-server screen, a native large title on the tab roots, morphing cards between grid and list.

# Part 7: Refinement on the device

Settled in a `/grilling` session on 2026-11-17, after using Part 6 on Mike's iPhone. Nothing here changes CONTEXT.md's vocabulary: the avatar shows **Offline** (CONTEXT.md), never "online".

## Problem Statement

On the device the app still reads as half-native. Glass is decided button by button, so neighbouring controls disagree. The tab headings sit under a scroll-edge blur at rest. Sheet content barely separates from the glass, and every sheet places its buttons differently. Drag moves headings and whole stores aside, feels worse than web, and its lifted card has never rendered. The library's view switch remounts every card. A list of small faults (control heights, a timer row that does nothing, a copied link that never shows) adds up.

## Solution

One glass rule, one panel anatomy, native large titles on the tab roots, our own drag inside `DragList`, and each listed fault fixed in its area's ticket.

## Implementation Decisions

### Rules (replacing Part 6's where they differ)

- **Glass rule.** A control that floats over content or sits in chrome is glass: header buttons, segmented switches, filter and lens pills, floating buttons (Today), sheet toolbar buttons, and chips laid over a photo (grid tags). Primary actions stay solid. A control inside a row, card body or form field is not glass (steppers in lists, list-view tags, inputs). A glass button is the shared `GlassIconButton` look.
- **Panel anatomy.** Every sheet: native header with the title, glass close on the left, the confirm (✓ or a verb) on the right. Apply/Save/Add are always the header confirm; secondary actions (Clear filters, Select all/Deselect all) are glass header items or a header menu when there are several. No pinned action buttons and no footers anywhere. Replaces Part 2 "Loading and sheets" on pinned actions.
- **Content on glass.** Nothing on a sheet is solid. Grouped content (rows, the day strip, chips) uses one translucent fill token, `bg-fill`, built like iOS's tertiary system fill (the foreground at low alpha), so it darkens on light glass and lightens on dark glass. Checked on the device in both themes.
- **Sheet heights.** List and search sheets take [0.5, full] detents and accept UIKit's full, opaque height while typing (replaces the single 0.5 detent of issue 36). Sheets sized to their content (making a grocery) stay fixed.
- **Fields.** One HeroUI field style for `SheetInput` and `SheetSearchField`: the iOS search-field look, `bg-default`, fully rounded, no ring. No SwiftUI `TextField`: it only looks native inside a SwiftUI Form.

### Tab roots

- Native large titles on Recipes, Groceries, Pantry and Calendar replace `TitleRow` and the `top: "soft"` scroll-edge effect that blurred it at rest. Reverses Part 6's TitleRow exception and its out-of-scope line.
- At rest the large title sits on the same line as the bar items (App Store style: title left, glass items right, no empty bar row above it). Scrolled, the large title scrolls away with the content and no inline title takes its place: the bar holds only its items. Header items are translucent glass (content shows through), never solid fills. Calendar has no sync button in its bar.
- Where the switches, pills and Filters go is drawn first on a canvas page (ticket 40) and reviewed by Mike before ticket 41. Mike's pick (2026-11-17): on Groceries and Pantry the bar holds the gear (Groceries) and the avatar; the Groceries/Pantry switch sits below the title and scrolls with the content (never sticky). Recipes: Filters and the avatar are the bar items; the grid/list switch stays beside "Your library" and scrolls with the content (never sticky); the All/Recipes/Cookbooks segmented control sits under "Your library" and scrolls with the content (never sticky).
- The avatar sits top right on all four. It opens a small native menu, like the recipe's conversion menu: a status line that always shows ("Live", or "Offline · N changes waiting" when Offline with Queued changes), Theme (System/Light/Dark), Language, All settings, Sign out. Only when Offline does the avatar carry a small warning dot, on all four tabs; VoiceOver reads "‹name›, Offline". The calendar's Offline pill goes, with nothing in its place.

### Calendar

- Today is glass at the bottom right, above the accessory. It follows the accessory's real placement, reported by a small native module (the scroll-direction guess fires before UIKit expands the bar), and moves with a layout transition.

### Recipes tab

- The grid/list switch is the Groceries `ListSwitch` (glass). A toggle flips locally at once and saves the Device Preference in the background; cards keep one key per recipe in both views and do not replay their entering animation, so nothing remounts.
- Filters and the All/Recipes/Cookbooks pills are glass.
- Grid tags work like the list's: the tags that fit, then `+N`, no scrolling, as glass chips over the photo. `TagStrip`, `useTagStrip` and `tag-strip-intent` go, with the swipe's `requireToFail` on them. Reverses Part 6's "grid cards show every tag in a row that scrolls sideways".
- Swipe actions reveal Mail-style: each action slides out at its own rate with the finger, the outer one lagging, so they fan out in sequence. A full swipe still runs the first action.
- The add-recipe sheet's copied-link row is reproduced on Mike's iPhone first (links copied from Safari, Instagram, Notes). The likely fault: `hasURLs` is false for a link copied as plain text. The fix asks iOS `detectPatterns(for: .probableWebURL)` (no paste prompt) through a local Expo module; reading the link still prompts.

### Recipe page

- The servings stepper, Convert menu and nutrition portion control share the ingredient control's height.
- Rating fills the stars left to right to the tapped one, each with a small spring scale; nutrition bars animate their width (~250 ms ease-out) when the portion changes. Both are skipped under Reduce Motion.
- Cookbooks: Manage is a glass icon button (its icon's `currentColor` goes); the cookbook chips take the timer chips' fill (`bg-default`, `tint.soft` on a tinted page), no border.
- Tapping a timer row in the timers sheet closes it and opens cook mode at the timer's step (the first step without one). The row's round buttons keep their actions.

### Sheets

- Add to groceries: Select all/Deselect all and the pantry button are glass. Plan recipe: the day strip, slot selector and row plus buttons are glass. Filters: Apply is the header confirm, Clear filters a glass header item (its `bg-warning/20` goes).

### Drag

- Rows part while dragging (2026-11-19, Mike: "like web"); headings shift only to make room. `react-native-reorderable-list` goes; `DragList` keeps its interface (`rows`, headings, `onDrop`) and the FlatList stays virtualised, with our own drag on Gesture Handler and Reanimated, modelled on web:
  - ~250 ms hold decided on the UI thread, haptic on lift.
  - An opaque card with a shadow follows the finger; the source stays as a faded ghost.
  - The rows between part to make room and the faded source sits where the row lands (no drop line, 2026-11-19); the target section is outlined.
  - A light haptic on crossing into another section, medium on drop.
  - Frame-driven auto-scroll.
  - A drop on a heading lands in that section, so empty and collapsed sections take drops; a drop above the first heading snaps back. No remount on drop.
- Why not a library (reverses ticket 19's choice): no maintained virtualised RN library keeps section headings still; drax's cross-list is experimental and on the JS thread; SwiftUI `onMove` reflows headings and drops the Calendar's FlatList features; iOS 27's `reorderContainer` is worth it only once iOS 27 is the floor. Found on the way: the lifted card of ticket 25 never rendered (`useIsActive` needs `shouldUpdateActiveItem`, never passed), and the hold was RN's 500 ms default.

### Scope and order

Ticket 39 (rc CI) and 40 (canvas) run at the same time; then 47 (drag), 48 (copied link) and 49 (Pantry search); then 42, 43, 45, 46 and 44; 41 last, after Mike approves the canvas. No release notes: the mobile app is unreleased.

## Testing Decisions

- Gates per ticket. New logic gets unit tests: the drop resolution and hit-testing, the staggered swipe offsets, the copied-link decision, the tag fit. Maestro flows stay green and change where a control moved (the `calendar-offline` flow checks the screen, not the pill). Motion, haptics, glass and contrast are checked by hand on Mike's iPhone in both themes. E2E and the full Maestro run once after the whole set.

## Out of Scope

- Building out the Settings tab (All settings opens what is there), Android drag, a native SwiftUI drag list.

# Part 8: Panels and controls

Drawn on the canvas page "Panels & controls" (https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz, page `panels`, v108, 2026-11-19). The boards are the source of truth: `project/Panel.dc.html` (one base, prop `panel` = addRecipe … switch, `dark`), `PnOpacity` (layer rules) and `PnComponents` (what each board becomes in code). Local copies and light/dark renders of every panel: see "Boards" below.

## Problem Statement

Every sheet builds its controls locally and the glass rule of Part 7 put glass inside sheet bodies (GlassStepper, GlassSegmented, glass pills) and translucent `bg-fill` content on glass, so fills change with whatever is behind the sheet and contrast fails over photos. Neighbouring sheets disagree on field, stepper, switch and button looks.

## Solution

One control kit, each control with a single home that every sheet and page uses and never restyles; then every sheet rebuilt from the kit to its board.

## Implementation Decisions

### Rules (replacing Part 7's "Glass rule" and "Content on glass" where they differ)

- **Glass only in the UI layer.** In a sheet, glass is only the native sheet itself (while not at full height) and its header: close/back, the one secondary icon (several become one menu), the primary action (native prominent bar item, accent tint, white label; plain glass when disabled). Outside sheets: tab bar, its accessory, nav buttons, Today, the heart over photos stay glass. Nothing in a sheet body or the page's content layer is glass.
- **Content fill = solid sand.** One solid fill for fields, cards, chips, day chips, segmented and stepper tracks, on every sheet and page: light `rgb(234 228 214)`, dark `rgb(46 42 34)`. Never translucent, never on another fill. Replaces `bg-fill` on content.
- **Body controls are solid.** Round icon buttons, pills, stepper knobs, switch thumbs, photo remove: solid white (light) / `--thumb` grey (dark), small shadow, no blur. In-body primary (Import on the clipboard row) is solid accent. Selected chip/day/tick = solid accent; segmented and switch keep the white thumb; single-pick lists show a checkmark.
- **Text is never opacity.** Primary, secondary, placeholder and accent text are separate solid colours chosen to pass 4.5:1 on a 65% sheet over pure black or white (`PnOpacity`). Disabled (40%) is for controls only. Divider 15% light / 10% dark.
- **Sizes.** Segmented standard 44, compact 34 (All/Any, icon switch share it). Body icon buttons 40.

### The kit (PnComponents)

Sheet header (`modal-header.tsx`, gains a subtitle), Field (text, search with clear, multi-line), Segmented (standard, compact, icon; `glass-segmented`, `slot-tabs`, `list-switch` become one, "Glass" leaves the name), Stepper (compact or full width; `glass-stepper` + `servings-stepper` become one), Switch (inset track, solid thumb, not glass), Card and row (one sand card, hairline rows; ends: value + chevron, switch, tick, checkmark, + button, tag), Tick (multi-select circle) and Checkmark (single pick), Chip (sand off, accent on; even-chip rows for scales), Icon button (new; tones default, accent, danger, disabled), Pill button (new; icon optional; default or danger), Tag (`pill.tsx` extended: Active green, Expired yellow, On the list green; solid fill, plain text), Plan block (day strip, slot tabs, day cards with a + per day; Plan this recipe, Move, Planned item, Plan recipe all use it, `move-fields.tsx` goes), Swipe actions (solid coloured circles; a full swipe commits the outermost action, Delete, which stays a circle and follows the card edge, the others drop away, the card slides off, the row closes).

### Boards

Rendered light | dark PNGs of every panel are in the orchestrating session's scratchpad (`boards/<panel>.png`) and reproducible: `node shoot.cjs Panel.dc.html 'panel=<name>' out.png [height]` with the canvas files read through the Artifact tool (`read`, `paths: ["project/Panel.dc.html"]`). Panels: addRecipe, importLink, importText, importPhotos, filters, addToGroceries, plan, planRecipe, addToCookbook, cookbookAdd, newCookbook, rename, move, servings, share, shareEmpty, timers, choice, item, addItems, editItem, storeStep, repeat, product, stores, storeEdit, pantryAdd, food, kit, switch.

### Scope and order

50 kit, 51 sheet header, 52 plan block, 53 sheets on the kit, 54 swipe actions, 55 device check and docs. No release notes: the mobile app is unreleased.

## Testing Decisions

Gates per ticket. Unit tests for kit behaviour (segmented selection, stepper bounds, switch, swipe commit), not looks. Looks are checked against the boards on the iOS 27 simulator in both themes in ticket 55, plus Maestro flows where a control moved. Web E2E is untouched by a mobile-only set and runs once at the end only if a shared package changed.

## Out of Scope

Web, Android-specific looks, Settings sub-pages beyond the share links sheet, the Calendar widgets.
