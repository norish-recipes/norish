# 18 — Today's meals visibility holds from the first frame

**What to build:** A reader who set Today's meals to hidden never sees it. Today the setting lives in localStorage, so the server renders the full Today block, the browser paints it, and only then does the client read the preference and remove it — the whole dashboard below jumps up. This is the worst flicker in the app because it removes an entire section rather than re-arranging one.

The three-state placement rule — always, only when something is planned, hidden — moves onto a device-preference cookie. The spec already fixes this preference as device-local rather than server-side, and a cookie is exactly that: it stays on the device, the server can just finally see it while rendering.

**Blocked by:** 16 (one helper for device-preference cookies).

**Status:** done

- [x] With the section hidden, the HTML the server sends for the dashboard does not contain the Today block, and nothing below it moves on load.
- [x] With "only when planned", the placement rule is applied in the server-rendered markup, not after hydration.
- [x] The settings select for Today's meals reads and writes the same preference and keeps working exactly as it does now — ticket 04's criterion that this select stays a device-local three-state rule still holds word for word.
- [x] A navigation answered by the service worker's cached HTML, and the offline bootstrap, both settle on the cookie's current choice.
- [x] No fallback read of the old localStorage key: a reader who had hidden the section hides it once more and it sticks.
- [x] Page-level tests assert the server-rendered dashboard for each of the three states, and the settings suite's today's-meals tests keep passing with no more than fixture updates.

## Comments

- Shipped. The rule is a `defineDevicePreference` declaration (`lib/todays-meals-visibility.ts`) behind a context mounted in the app shell, so the dashboard block and the settings select share one state; the `(app)` layout gained the server pass that reads the cookie and seeds the shell, and the offline bootstrap mounts the same shell unseeded so the provider self-reads. Dev-server smoke: a dashboard request carrying `hidden` arrives without `today-meals-heading`, `planned` and `always` arrive with it. One honest limit on the planned criterion: which slots hold food is client-fetched calendar data, so the server applies the placement rule to the extent it can know it — `hidden` never renders anything, while `planned` renders the block's loading shell and collapses only when the day proves empty, exactly as before this ticket. The old localStorage key and its hook are gone with no fallback read. The settings suite gained a select read/write test (there were no today's-meals tests to keep); the todays-meals suite needed only the mock moved to the context module and its 3-tuple trimmed to the context pair.
