# 18 — Today's meals visibility holds from the first frame

**What to build:** A reader who set Today's meals to hidden never sees it. Today the setting lives in localStorage, so the server renders the full Today block, the browser paints it, and only then does the client read the preference and remove it — the whole dashboard below jumps up. This is the worst flicker in the app because it removes an entire section rather than re-arranging one.

The three-state placement rule — always, only when something is planned, hidden — moves onto a device-preference cookie. The spec already fixes this preference as device-local rather than server-side, and a cookie is exactly that: it stays on the device, the server can just finally see it while rendering.

**Blocked by:** 16 (one helper for device-preference cookies).

**Status:** ready-for-agent

- [ ] With the section hidden, the HTML the server sends for the dashboard does not contain the Today block, and nothing below it moves on load.
- [ ] With "only when planned", the placement rule is applied in the server-rendered markup, not after hydration.
- [ ] The settings select for Today's meals reads and writes the same preference and keeps working exactly as it does now — ticket 04's criterion that this select stays a device-local three-state rule still holds word for word.
- [ ] A navigation answered by the service worker's cached HTML, and the offline bootstrap, both settle on the cookie's current choice.
- [ ] No fallback read of the old localStorage key: a reader who had hidden the section hides it once more and it sticks.
- [ ] Page-level tests assert the server-rendered dashboard for each of the three states, and the settings suite's today's-meals tests keep passing with no more than fixture updates.
