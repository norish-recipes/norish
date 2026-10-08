# Device Preferences on the profile

Status: done

Settled in a `/grill-with-docs` session on 2026-10-08. The vocabulary is CONTEXT.md's **Device Preference** and **Device Kind** (both added that day), with **Hidden Item**, **Dish Colour**, **Outbox**, **Warm Set** and **App Shell**. Nothing here is expensive to reverse, so it adds no ADR; the Device Kind entry carries the one surprising choice (a kind, not a particular device). Target Version: 0.25.0-beta. Tickets are in `issues/`.

## Problem Statement

A reader's display choices are fractions or decimals, Hidden Items, the recipe page colour, Today's meals, grid or list, and the grocery view and grouping. They live in cookies the page writes for itself. Safari, and so every browser on an iPhone, cuts a cookie written that way to seven days, so a choice left alone for a week quietly goes back to its default. An installed home-screen app keeps its own cookies, so choices made in Safari never reach it, and clearing site data loses all of them. Each loss shows up the same way: the page draws something the reader had turned off.

Some loading states ignore the reader's choices altogether. The recipe skeleton draws rating and nutrition placeholders even when both are hidden, and the grocery skeleton is always drawn in the store view. The cookbook page only learns grid or list in the browser.

## Solution

Every Device Preference is kept on the reader's profile, once for phones and once for desktops. Norish works out the Device Kind from the browser on every request, so nothing about the device is remembered and nothing can be wiped. The server draws the first frame with the reader's choices for that kind already applied, skeletons included. A new phone starts from the reader's phone choices, and the installed app and Safari agree.

Settings changes the kind you're on and says which. A change made Offline applies at once and saves through the Outbox. A signed-out reader sees the defaults. Choices stored in cookies today are not carried over: the upgrade resets them once, and the release notes say so.

## User Stories

1. As a reader on an iPhone, I want a choice I made weeks ago to still hold, so that the page never quietly reverts to showing what I hid.
2. As a reader who installed Norish on my home screen, I want the app to use the choices I made in Safari on the same phone, so that I don't set everything up twice.
3. As a reader who clears my browser's site data, I want my choices back as soon as I sign in again, so that clearing a cache never costs me my setup.
4. As a reader who gets a new phone, I want my phone choices waiting on the first sign-in, so that a new device feels like mine straight away.
5. As a reader, I want my phone and my desktop to keep separate choices, so that a cramped phone can hide what a desktop keeps.
6. As a reader on a desktop, I want a choice I change on my phone to leave my desktop alone, so that tuning one screen never disturbs the other.
7. As a reader on a tablet, I want it treated like a desktop, so that it gets the roomier layout's choices.
8. As a reader, I want the first frame of every page drawn with my choices already applied, so that nothing appears only to vanish a moment later.
9. As a reader who hid the rating, I want the recipe page's loading skeleton to draw no rating placeholder, so that the skeleton has the shape of the page I'll actually get.
10. As a reader who hid Nutrition Information, I want the recipe page's loading skeleton to draw no nutrition placeholder, so that the page doesn't shrink when it arrives.
11. As a reader who views groceries by recipe, I want the grocery skeleton drawn by recipe, so that the list doesn't change shape when it loads.
12. As a reader who turned off grouping, I want the grocery skeleton drawn ungrouped, so that the loading state matches the list.
13. As a reader who prefers the list layout, I want a cookbook to open as a list from the server, so that it never flips from grid to list.
14. As a reader who prefers the list layout, I want the library to open as a list, as it does today.
15. As a reader, I want a recipe's amounts drawn as fractions or decimals from the first frame, as I chose for this kind of device.
16. As a reader who turned off the dish colour, I want recipe pages drawn on the plain theme background from the first frame, so that no tint flashes before going away.
17. As a reader who hid Today's meals, I want the dashboard drawn without it from the first frame.
18. As a reader who shows Today's meals only when something is planned, I want to accept that its skeleton may give way to nothing, because only the browser knows what's planned for today.
19. As a reader in settings, I want one line telling me these choices apply to phones (or desktops), so that I know why my other device looks different.
20. As a reader in settings, I want a toggle to apply immediately, as it does today, so that saving to my profile costs me nothing in feel.
21. As a reader who flips grid or list, fractions or decimals, or the grocery view straight on the page, I want that remembered on my profile just like a settings change.
22. As a reader who is Offline, I want a choice I change to apply at once, so that being Offline never blocks tuning the page.
23. As a reader who changed a choice Offline, I want it saved to my profile once I'm Live again, so that my other screens of the same kind get it.
24. As a reader who opens Norish Offline on a page it never visited, I want that page drawn with my choices, so that Offline start-up doesn't fall back to defaults.
25. As a reader whose browser serves a page saved before my last change, I want the page to settle on my current choice once it has loaded, so that an old saved copy never wins for good.
26. As a reader who reloads while a change still waits in the Outbox, I want the page to settle on the change I made, so that a reload doesn't undo it.
27. As a reader who changes a choice on my phone in Safari and again in the installed app, I want the last change to win, so that no change is rejected as out of date.
28. As a reader editing my name while a preference change is queued, I want both to save, so that a display toggle never makes another profile edit fail.
29. As a reader changing my language, I want my Device Preferences left exactly as they were, so that one profile edit never puts back an older copy of another.
30. As a signed-out reader of a shared recipe, I want the whole page with the defaults, so that a shared link shows the recipe as it is.
31. As a signed-out reader of a shared recipe, I want the fractions or decimals switch to work for my visit, so that I can read the amounts my way while I cook.
32. As a signed-in reader opening a shared recipe, I want my own choices applied, as they are today.
33. As a reader upgrading to 0.25.0, I want the release notes to tell me my display choices reset once, so that the reset is expected rather than a surprise.
34. As a self-hoster, I want nothing to configure, so that the upgrade needs no action from me.
35. As a reader who has used one kind only, I want a first visit on the other kind to start from the defaults, so that each kind's choices are made on that kind.
36. As a reader who picks "request desktop site" on a phone, I want to get my desktop choices, because I asked the page to treat me as a desktop.

## Implementation Decisions

- **Device Kind** is phone or desktop. One shared pure function maps a user-agent string to a kind: a `Mobi` token means phone, anything else means desktop. Chromium's reduced user agent keeps the token on phones, Android tablets omit it, and iPad Safari sends a Mac user agent by default, so all of these land as the glossary says. The server applies the function to each request's user-agent header. The browser applies the same function to its own user agent when it starts with no server pass (Offline start-up). Same input, same rule, same answer, so the kind is never stored and never sent from one side to the other.
- **Storage.** The profile's existing preferences document gains a block per Device Kind. Each block holds only the choices made on that kind, and an absent choice is its default. No new table, no data migration. Each value parses to a valid value or its default. Hidden Items keep their current rule: the stored list carries entries the control doesn't show (a gated-off timer entry, an entry from a newer version) so writing the list back never drops them.
- **One definition.** One schema in the shared contracts names every Device Preference with its values and default. It replaces the per-cookie definitions as the single place a preference is declared.
- **Write.** A new signed-in user procedure sets one or more Device Preferences for a named Device Kind:
  - It merges into that kind's block in the database, per choice, so it never rewrites the whole preferences document.
  - The last writer wins. The write stays outside the profile's version check, so a toggle never goes stale and never makes a pending name change stale.
  - The kind travels in the input, so an Outbox Replay lands on the kind the change was made on.
  - Unknown values are rejected.
- **The existing language and after-planning update writes only the keys it was given.** Today it reads the whole document, merges in memory and writes it back, which would put back a stale copy of the Device Preferences if a toggle landed in between.
- **Server read.** The profile is read once per request, and the locale lookup and the Device Preferences share that read. The read resolves the session, takes the Device Kind from the request, and returns that kind's block parsed to full values. A signed-out request gets the defaults.
- **One provider in the App Shell** holds the reader's Device Preferences for this kind, seeded by the server read. The per-preference hooks keep their shape, so consumers don't change. The grocery view and grouping and the recipe grid or list move into this provider too, which gives the cookbook page the server's value. The share page mounts the same provider. A signed-in reader gets their own choices. A signed-out reader gets the defaults, with switches held in memory for the visit.
- **After hydration the profile query is the source of truth.**
  - A change updates that query's cache at once and sends the write. Offline, the write waits in the Outbox, which admits any change.
  - When the query disagrees with what was painted, the query wins. That covers HTML the service worker served from its cache, and a reload while a change still waits in the Outbox.
  - The profile query joins the Warm Set, so Offline start-up has it.
- **Offline start-up** (no server pass): the provider works out the Device Kind in the browser and reads that kind's block from the persisted profile query. The bootstrap already waits for the restored cache before it renders, so nothing paints with defaults first.
- **Settings.** The preferences card writes the kind you're on and says which in one line ("These apply to phones" or "These apply to desktops"), translated into every locale.
- **Skeletons.**
  - The recipe skeleton, in its phone and desktop layouts, leaves out the rating and nutrition placeholders when those are Hidden Items.
  - The grocery skeleton is drawn in the reader's view and grouping.
  - The library skeleton already follows grid or list and draws no stars, so it is unchanged.
  - Today's meals in "only when planned" keeps its skeleton.
- **Removed:** the preference cookies, their definitions, their server reads and client writes, and their tests. The language cookie used before sign-in stays.
- **Release notes and docs.**
  - An Upgrade notes bullet: display choices reset once and are now kept on your profile, per phone or desktop.
  - A Fixes and Improvements bullet: choices are no longer forgotten after a week on an iPhone, and the installed app and the browser agree.
  - The Hidden Items and recipe page docs change "per device" to "per phone or desktop, on your profile". The share-link sentence becomes "only Ingredient icons you hid stay hidden on a shared recipe you open while signed in".

## Testing Decisions

- A good test drives Norish the way a reader does and asserts what the reader sees or what the server stores. It never asserts which hook, cookie or cache key holds a value.
- **First-paint browser tests** (existing, the main seam). With JavaScript turned off they show exactly the HTML the server sent. They seed choices through the real API, then open the same page as an iPhone and as a desktop browser, and assert:
  - the grocery view and grouping
  - Hidden Items
  - the recipe skeleton without hidden placeholders
  - the defaults when nothing is stored
  - that one kind's choices never show on the other.
- **Offline browser tests** (existing):
  - A change made Offline applies at once and is on the profile once Live again.
  - A page served from the service worker's cache settles on the profile's current choice.
  - Offline start-up on an unvisited route uses the stored choices.
- **API tests for the user procedures** (existing):
  - A write changes one kind only, and never the other kind, the language or after-planning.
  - The language update can't overwrite Device Preferences.
  - Values outside the defined set are rejected, and signed-out requests are refused.
  - Replaying the same write is harmless.
- **The Device Kind rule** (new, one pure function): a table of user-agent strings for iPhone, Android phone, Android tablet, iPad in desktop mode, Mac and Windows.
- The preference-provider unit tests are rewritten against the new provider. The cookie unit tests are deleted along with the cookies.
- Prior art: the first-paint browser spec, the offline browser spec, the user procedure tests (including the stale-version tests), the preference-provider tests and the preferences card tests.

## Out of Scope

- **The theme.** It stays in browser storage. Safari may drop an explicit light or dark after a week and fall back to System, which is accepted.
- **Library filters and sort order.** They stay in browser storage.
- **Running recipe timers.** They are cooking state, not a choice.
- **Language and after-planning.** They stay per person.
- **Editing the other kind's choices from settings.**
- **Pushing a change live to another open screen of the same kind.** It shows on that screen's next load or refetch.
- **Carrying cookie values over.**
- **Tablets as their own kind.**
- **The parked mobile app.**

## Further Notes

- Whether anything is planned today is only known in the browser, by the browser's own date, which is why the "only when planned" skeleton can still give way to nothing.
- Better Auth keeps sessions in Redis. Nothing here touches sessions or adds a device record.
