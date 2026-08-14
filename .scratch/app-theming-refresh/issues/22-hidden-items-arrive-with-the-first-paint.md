# 22 — Hidden Items arrive with the first paint

**What to build:** A reader who hid something through Hidden Items never sees it flash. Ticket 04 stores the hidden list server-side so it follows the reader between devices — the right call, but it reintroduces the flicker this plan is stamping out through a different door: if the list arrives by a client-side fetch after first paint, hidden ratings and favourites render and then vanish, exactly the localStorage failure with the network in the localStorage role.

This ticket makes the hidden list part of what the first render already knows, on every load path: the server render reads the reader's preferences while producing the HTML, and the offline app shell finds the list in the persisted cache rather than waiting on the network. How the seed travels (server pass, warm set, or both) is the implementer's call; the behaviour is that no consumer of the hidden list ever renders before knowing it.

**Blocked by:** 04 (Hidden Items replaces the display preferences).

**Status:** done

- [x] With ratings hidden, a fresh load of the recipe page, the library and the filters panel never paints a rating — not one frame.
- [x] The same holds for every other entry in the hidden list, including the recipe page sections once ticket 12 wires them: any consumer reads the seeded list, so later hideables inherit this for free.
- [x] A navigation answered by the service worker's cached HTML, and the offline bootstrap, both apply the reader's hidden list without waiting on the network.
- [x] Changing the hidden list in settings applies immediately and the next load, online or offline, honours it from the first frame.
- [x] An empty or absent list renders everything, with no delay compared to today.
- [x] Page-level tests assert the server-rendered recipe page for a reader with a hidden list, and an offline test covers the shell applying the persisted list.

## Comments

- 2026-08-14: superseded in mechanism by ticket 23 — the list moves onto the `norish_hidden_items` device-preference cookie, which retires the server preferences pass and the localStorage mirror described below. The behaviour this ticket pinned (no consumer renders before knowing the list, on any load path) is unchanged and stays tested.
- Shipped as server pass AND device mirror (the ticket's "both"). A `HiddenItemsContext` now owns the list every consumer reads — `useHiddenItemVisibility` and the timers preference both moved onto it, so no consumer can see the user object's pre-fetch null and mistake it for "nothing hidden". Its first frame is fed by seniority: the `(app)` layout's server pass (session → `getUserPreferences`, parsed exactly as `user.get` parses it, the same shape the i18n request config already uses), else a localStorage mirror (`lib/hidden-items-mirror.ts`) for the two paths with no server pass — the offline bootstrap and a navigation answered by the service worker's cached HTML — else empty. Once the live user arrives with preferences the live list takes over and rewrites the mirror, which is how a settings change applies immediately and survives to the next load. The mirror is keyed to the persisted cache's boot owner (ADR-0005), so an account switch can't paint the previous reader's choices, and an explicit sign-out clears it alongside the read cache. The offline prerender never mounts the shell, so no user data enters the precached document. One honest note on "server-rendered recipe page": the recipe page is client-fetched under the server layout, so the server's contribution is the seed, not recipe markup — the page-level suites assert sections per hidden list from the seeded context, and the context suite pins the first-frame invariants (seed governs while the user is session-only, mirror drives the offline shell's visibility flags, foreign-owner mirror ignored, live overrides and rewrites).
