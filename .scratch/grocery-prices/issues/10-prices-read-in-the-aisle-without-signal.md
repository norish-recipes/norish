# 10 — Prices read in the aisle without signal

**What to build:** Products and links join the offline **Warm Set** beside the groceries and stores lists, so a warmed list shows its product names, prices, sale badges and totals with the backend gone. Set Price, clearing it, Pack Count, choosing a link, unlinking and making a by-hand product are Outbox-eligible with Client-Minted Ids and replay when the backend returns. Search, paste, discovery and refresh need Live and their doors carry the standard offline disabled state instead of failing.

**Blocked by:** 03 — totals are what the aisle wants to read offline.

**Status:** ready-for-agent

- [ ] The products and links queries are warmed with the groceries and stores lists and kept with the same retention
- [ ] A warmed list opened with the backend stopped shows every row's product name, effective price, sale badge and age, and every header's totals, unchanged from Live
- [ ] Set Price, clear, Pack Count, choose link, unlink and by-hand create queue in the Outbox with client-minted ids, replay in order, and a replay against a changed row parks as Conflicted rather than being dropped
- [ ] The picker's search and paste doors, the store's refresh action and the manager's discovery state show the standard offline disabled affordance while offline and recover on reconnect
- [ ] The offline browser project seeds a priced product and proves the warmed read with the backend stopped and a Set Price made offline replaying
