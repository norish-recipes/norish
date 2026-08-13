# 22 — Hidden Items arrive with the first paint

**What to build:** A reader who hid something through Hidden Items never sees it flash. Ticket 04 stores the hidden list server-side so it follows the reader between devices — the right call, but it reintroduces the flicker this plan is stamping out through a different door: if the list arrives by a client-side fetch after first paint, hidden ratings and favourites render and then vanish, exactly the localStorage failure with the network in the localStorage role.

This ticket makes the hidden list part of what the first render already knows, on every load path: the server render reads the reader's preferences while producing the HTML, and the offline app shell finds the list in the persisted cache rather than waiting on the network. How the seed travels (server pass, warm set, or both) is the implementer's call; the behaviour is that no consumer of the hidden list ever renders before knowing it.

**Blocked by:** 04 (Hidden Items replaces the display preferences).

**Status:** ready-for-agent

- [ ] With ratings hidden, a fresh load of the recipe page, the library and the filters panel never paints a rating — not one frame.
- [ ] The same holds for every other entry in the hidden list, including the recipe page sections once ticket 12 wires them: any consumer reads the seeded list, so later hideables inherit this for free.
- [ ] A navigation answered by the service worker's cached HTML, and the offline bootstrap, both apply the reader's hidden list without waiting on the network.
- [ ] Changing the hidden list in settings applies immediately and the next load, online or offline, honours it from the first frame.
- [ ] An empty or absent list renders everything, with no delay compared to today.
- [ ] Page-level tests assert the server-rendered recipe page for a reader with a hidden list, and an offline test covers the shell applying the persisted list.
