# Bring! Shopping List

Status: ready-for-human

## Problem Statement

A household that already shops with Bring! has two shopping lists. Norish plans the meals and holds the recipes, but the list the household carries into the shop lives in Bring!, so every "add to groceries" is followed by retyping the same lines into the other app, or by never using Norish's list at all and leaving its tab, its Stores and its Pantry split as dead weight. The built-in list is good for a household that wants prices, aisles and shared ticking inside Norish; it is the wrong place to send ingredients for a household whose list is somewhere else.

Bring! offers no way to push items into a list. Its recipe import takes the address of a web page that carries a schema.org Recipe, and Bring!'s own servers fetch that page. A self-hosted Norish is usually behind a login and sometimes behind a home router, so nothing about it is a page Bring! can read.

## Solution

An administrator chooses the instance's **Shopping List Provider**: the built-in grocery list, which is today's behaviour and the default, or Bring!. In Bring mode the built-in list disappears from the web app (its tab, and its pages redirect home) and every "add to groceries" path sends the ticked ingredients to Bring! instead. It is a switch in the user interface and nothing else: no grocery is deleted, the server still accepts grocery writes, the public API and recurring groceries keep working, and switching back shows the list exactly as it was.

The ingredients travel as a **Bring Handoff**: the server stores the lines under an unguessable token for an hour, serves them from a public page that carries only a title, the lines and the recipe's primary picture as a schema.org Recipe, asks Bring! for the link that imports that page, and gives the link back. The handoff is prepared when the panel opens and rewritten as the picks change, so that one press on **Add to Bring!** only opens the link and Bring! opens in a new tab (in an iPhone Home Screen app, in the Bring! app); a toast with **Open Bring!** appears only if the browser blocked that tab. The phone app, when it follows, opens Bring! directly. Because Bring!'s servers must fetch the page, the instance has to be reachable from the internet over HTTPS; Norish checks that before it asks and says so when it is not.

## User Stories

1. As an administrator, I want to choose Bring! as the instance's shopping list in the admin settings, so that the household stops keeping two lists.
2. As an administrator, I want the setting to say that Bring!'s servers fetch a temporary public page, so that I know the instance must be reachable from the internet before I switch.
3. As an administrator, I want the default to stay the built-in list, so that nothing changes on an instance until I decide.
4. As an administrator, I want to switch back at any time and find every grocery, Store and recurring grocery where I left it, so that trying Bring! costs nothing.
5. As a household member, I want the Groceries tab gone once the instance uses Bring!, so that I am not offered a list nobody keeps.
6. As a household member, I want a bookmarked or typed `/groceries` address to take me home in Bring mode, so that I never land on a list that is no longer used.
7. As a household member, I want every "add to groceries" action to say "Add to Bring!", so that I know where the ingredients are going.
8. As a household member, I want to tick which ingredients go to Bring! and edit an amount or name first, as I do for the built-in list, so that sending is as deliberate as adding.
9. As a household member, I want ingredients already in my pantry to stay apart and unticked, so that Bring! gets what I have to buy and not my staples.
10. As a household member, I want the amounts sent to match the servings I chose, so that Bring! gets a list for the meal I am cooking.
11. As a household member, I want Bring! to receive the recipe's name, so that it shows which recipe the items are for.
12. As a household member on the web, I want one press to open Bring! with the items, the button showing a spinner while the list is made ready after each change I make, and an **Open Bring!** button only when my browser blocked that tab.
12a. As a household member on an iPhone Home Screen app, I want that press to open the Bring! app, which iOS does only when the link is opened straight from a tap.
12b. As a household member, I want the list taken down when I close the panel without opening Bring!, and otherwise after an hour.
13. As a household member, I want a clear message when Bring! cannot reach the instance, did not answer, refused the items or I sent too many, so that I know what to do next.
14. As a household member, I want a send that fails offline to say so and not to be replayed later, so that a dead link is never opened an hour on.
15. As a household member, I want to add ingredients only for recipes I can read, so that a shopping list cannot leak a recipe I have no access to.
16. As a household member, I want adding the same ingredients twice in one sheet to send them once, so that a double tap does not double the list.
17. As an administrator, I want the page Bring! reads to show only a title, the item lines and the recipe's primary picture, so that no person, household or recipe link is ever published.
18. As an administrator, I want the page to disappear after an hour and to be unguessable until then, so that the exposure is short and not enumerable.
19. As an API user, I want `/api/v1/groceries` to behave as before, so that an integration does not break when the household changes how it shops.
20. As a household member with recurring groceries, I want them to keep their schedule and keep adding to the built-in list, so that switching back finds them current.
21. As a mobile user, I want the phone app to keep working unchanged until it follows, so that a web-only switch never breaks it.
22. As a self-hosting operator, I want no AI provider involved and a single outbound request per send, so that sending is free and private.

## Implementation Decisions

**Vocabulary and the decision on record.** The words are **Shopping List Provider** and **Bring Handoff**, defined in CONTEXT.md under Groceries & Stores. ADR-0041 records the decision: the external list is a one-way handoff through a temporary unauthenticated page, the switch is a user-interface switch that keeps all grocery data, and four alternatives were rejected. Everything below follows from it.

**One setting, three places it is read.** `grocery_list_provider` is an instance configuration key, `"builtin"` or `"bring"`, not sensitive, seeded to `"builtin"`. The admin general settings set it through `admin.updateGroceryListProvider`, which announces the change like the other general settings do; every signed-in client reads it through `config.groceryListProvider`, and a shared hook, `useGroceryListProvider`, answers `builtin` while it loads. The server reads it again in `bring.prepare` and `bring.update`, so a stale client cannot send to Bring! on an instance that switched back.

**The send.** `bring.prepare` takes the picked lines, optionally a recipe id and the servings they are scaled to, and returns either the Bring! deeplink with the handoff's token or a reason it could not: not in Bring mode, not publicly reachable, the page unreachable for Bring!, Bring! unreachable, Bring! rejected the page, or rate limited. Expected failures are returned and not thrown. A recipe id is checked for access and supplies the title; otherwise the title is the one sent, or "Norish". A person may prepare thirty handoffs in ten minutes; a prepare counts only once it has passed the provider, recipe-access and reachability checks, and an update does not count. The instance is publicly reachable when `AUTH_URL` is HTTPS and neither is nor resolves to a private address; the check is skipped only when `BRING_API_URL` is not Bring!'s own address, which is how the tests stand in for Bring! (`ALLOW_PRIVATE_ADDRESSES` plays no part). Bring!'s deeplink must be `https` (`http` only for such a stand-in), and a handoff whose deeplink Bring! did not give is deleted, and one the reader leaves without opening Bring! is deleted when the panel closes. Lines carry the unit as the interface writes it, short and in the reader's language, and an item with no usable name is ignored. The Bring! router is never queued offline: a replayed procedure would point at a page that expired while the phone was out of signal. `bring.update` rewrites the same handoff, keeping its original hour, for the person who prepared it, without a request to Bring!; `bring.discard` deletes it. The stored record also holds the id of that person, which only those two compare and the page never shows.

**The handoff page.** `GET /share/bring/<token>` is public (`/share/**` is already outside the sign-in redirect), answers 404 for a malformed, unknown or expired token, and otherwise a small HTML page: a heading, a list of lines, and the same content as a schema.org Recipe in JSON-LD, with the recipe's primary picture as its image. A stored picture is `<AUTH_URL>/share/bring/<token>/image`, a second public route that serves the file with `Cache-Control: private, no-store`, answers 404 otherwise and never shows the recipe id; an imported picture is its `https` address; a recipe with none gets the Norish brand icon. The token is 24 random bytes, base64url, 32 characters; the record, picture included, lives in Valkey for an hour (a TTL of 3600 seconds) and is not deleted on read, because it is not known whether Bring! fetches once or again later; a failed send deletes it at once. A reverse proxy must let `/share/bring/` through, page and `/image`, with no login, VPN or bot protection; one that lets `/share/` through covers it. The page and its headers carry no cookie, no identity and no link back, and tell search engines and caches to keep away.

**What a line is.** A line is "amount unit name" in the picked ingredient's own words, the amount rounded to two decimals, whitespace collapsed, at most 200 characters; Bring! parses the quantity out of the text. The recipe's primary picture is the only media the page carries.

**The switch is a user-interface switch.** In Bring mode the Groceries tab leaves the navigation, `/groceries/**` redirects to the home page (on the server and, for a live switch, on the client), and the built-in "add to groceries" panel sends its ticked lines to Bring! and keeps its selection, edit-in-place and Pantry split. The Pantry is consulted exactly as before, once, when a recipe is added; the pantry page goes with the Groceries pages and a pantry stays editable from the Ingredient panel. Nothing on the server blocks a grocery write, so REST, recurring groceries and the offline replay of grocery mutations are untouched, and the "on the list" relation is empty in Bring mode because nothing is on a list.

**One press, prepared beforehand.** A browser opens a tab, and iOS hands a link to a native app, only when the link is opened straight from a tap; a press that waited on the server first leaves an iPhone Home Screen app in an in-app browser. The handoff is therefore prepared when the panel opens, and every change of ticks, servings or edited lines disables the button with a spinner and, after 300 ms, rewrites the same handoff; the button is enabled once the handoff holds the current list. The deeplink does not change on an update, because it names only the page, which Bring! reads when it is opened, and the base and requested quantities are equal. The press calls `openExternalUrl` synchronously; on the web that is `window.open` in a new tab with the opener cut by hand, or `location.assign` in an iOS Home Screen app, and it answers false when the browser blocked the tab, which ends in a toast that stays until dismissed, with **Open Bring!**. A failed prepare shows its reason and a press tries again. "Add at once" after planning opens the panel when the list is Bring!. Before the deeplink is asked for, the server has Bring!'s recipe parser read the page, so a page Bring! cannot fetch fails in Norish with the status it got (`page-unreachable`), not later inside Bring!; a page it fetched but could not read is `bring-rejected`. On the phone `openExternalUrl` hands the link to the operating system and answers true.

**Realtime.** The setting rides the existing configuration announcement: a member sees the Groceries tab appear or vanish and the labels change when the administrator switches, without a reload.

**Copy and locales.** New strings in every locale: the setting's title, description, two options and notice, the Bring! labels and the five errors, and the two recipe menu entries.

**Docs and release notes.** A Bring! page under Groceries, a Shopping list section in the admin settings page, `BRING_API_URL` documented as a test seam, and a feature section on the release-notes page of the target version. The phone app does not follow in this release, and the docs say so.

## Testing Decisions

A good test here asserts what a member sees or is refused, and what Bring! receives, never how the handoff is stored. Four existing seams, one new fake.

**Browser E2E through the real stack** is the primary seam: a fake Bring! on a local port, wired through `BRING_API_URL`, records the request and fetches the page it was given itself, which proves the page is public. The spec switches the provider as an administrator and sees the Groceries tab disappear live; sees `/groceries` redirect; adds a recipe's ingredients and follows the deeplink the press opens; checks the fake received the ticked lines as a schema.org Recipe; sees a bad token answer 404; switches back and finds the tab and the data.

**tRPC procedure tests with mocked repositories** pin the send and the setting: no Bring! request outside Bring mode; a private `AUTH_URL` is refused as not public unless `BRING_API_URL` points at a stand-in for Bring!; success stores the formatted lines and returns the link; a recipe the person cannot read is refused; the thirty-first send in a window is rate limited; only an administrator changes the provider and the change is announced.

**Unit tests beside the server code** pin the line format, the page and its JSON-LD (a `</script>` in an ingredient stays text), the handoff store against an in-memory Valkey, and the Bring! client against a stubbed `fetch`.

**Hook and component tests** in the shared and web workspaces pin the rules: every outcome of the handoff hook (prepared once, rewritten after a debounced change, ready only when it holds the current list, the press opening the link or the browser blocking it and the web showing the toast, each failure reason, a retry on the next press, discard on close); the lines hook sends in Bring mode and never creates a grocery; the navigation loses Groceries and keeps its positions; the admin card saves immediately and shows the notice; the public page's headers and 404s; the proxy leaves `/share/bring/*` alone.

## Out of Scope

- The phone app: the groceries tab, its stack and its add screens follow in a later release. The app ignores the setting in this release: its platform adapter sets `supportsExternalShoppingList` to false, so the shared hooks keep the built-in list and its wording there, without asking the instance.
- Reading anything back from Bring!: ticked items, the list's contents, the household's Bring! lists.
- Choosing a Bring! list, or a per-user or per-household provider; the setting is the instance's.
- Other external lists; this is the one.
- Deleting, hiding or migrating grocery data when switching; a pantry page in Bring mode.
- Blocking grocery writes on the server or in the public API while Bring! is the provider.

## Further Notes

- Vocabulary: CONTEXT.md, Groceries & Stores: Shopping List Provider, Bring Handoff, and the existing Grocery, Pantry Ingredient. Use those words in code, tickets, copy and docs.
- ADR-0041 is the decision behind everything here; read it before touching the shape.
- Bring!'s deeplink endpoint is undocumented and was verified by probing: JSON `url`, `baseQuantity`, `requestedQuantity`, `source`, answered with a `deeplink`. If Bring! changes it, `bring-client.ts` is the only place that knows.
- After editing anything under the shared packages, refresh the injected `@norish` copies under the web app's node_modules and remove the web build cache, copies first, before a build or an E2E run.
- The E2E must never reach the real Bring!; the fake stands in through `BRING_API_URL`.
- Tickets follow from this spec, one file per ticket under this directory.
