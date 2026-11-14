# Mobile redesign: the iPhone screens

Status: sign-in tickets 01-06 done; Recipes tab tickets 07-17 open; Recipe, Groceries and Calendar tickets 18-30 open

Settled in a `/grilling` session on 2026-11-12. The design is the "Norish iOS" canvas (https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz); each section of this spec names the boards it builds. Vocabulary is CONTEXT.md's Accounts & Sign-in section (**Server Address**, **Account**, **Sign-in Method**, **Sign-out**, **Session Expiry**). Target Version: 0.27.0-beta. Branch `feat/mobile-redesign`, cut from `refactor/app-structure`; it rebases onto rc once app-structure merges. Each area got its tickets once the one before it had landed, as app-structure did: 01–06 are sign-in, 07–17 the Recipes tab (Part 2 below). Recipe, Groceries and Calendar were specced together on 2026-11-14 as Parts 3–5, tickets 18–30.

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
