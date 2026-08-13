# 16 — One helper for device-preference cookies

**What to build:** The library's grid/list choice recently moved from localStorage to a cookie, because a cookie is the only device preference the server can read while it produces the HTML — anything read after hydration forces the server to guess and the reader watches the page re-arrange a frame in. Three more preferences are about to make the same move (tickets 17, 18, 19). This ticket turns the library's bespoke cookie code into one shared device-preference helper so each of those tickets is a small consumer instead of a fresh copy.

The helper owns the whole shape a preference cookie needs: a parse that always lands on a valid value, a client read and write, a server-side read for seeding the first render, and a provider that seeds from the server value, falls back to reading the cookie itself when there was no server pass (the offline bootstrap), and reconciles once after mount because the service worker can answer a navigation with cached HTML that predates the last toggle.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

The cookie contract, so every preference looks alike. Names use underscores (cookie names cannot safely carry the `norish:` colon the localStorage keys used):

```
norish_recipe_view_mode        "grid" | "list"                 default "grid"   (exists today)
norish_grocery_view_mode       "store" | "recipe"              default "store"  (ticket 17)
norish_grocery_group_similar   "true" | "false"                default "true"   (ticket 17)
norish_todays_meals_visibility "always" | "planned" | "hidden" default "always" (ticket 18)
norish_amount_display          "fraction" | "decimal"          default "fraction" (ticket 19)
```

- [x] The library grid/list switch behaves exactly as it does today — same cookie name, so no reader loses their stored choice — but its cookie handling, provider seeding and stale-HTML reconcile now run through the shared helper.
- [x] The helper covers all three load paths: a server-rendered request carrying the cookie, a navigation answered by the service worker's cached HTML, and the offline bootstrap where no server pass happens at all.
- [x] An unrecognised or absent cookie value parses to the preference's default; the helper can never surface an invalid value.
- [x] Adding a new preference means declaring a name, its value set and a default — no per-preference parsing, document plumbing or reconcile code.
- [x] Unit tests cover the parse fallback, the read/write round trip and the seeded-versus-self-read provider paths, and the existing library view tests keep passing untouched.

## Comments

- Shipped. `lib/device-preferences.ts` holds `defineDevicePreference` (name + value set + default → total parse, nullable client read, client write), and `context/device-preference-context.tsx` holds the state half: `useDevicePreferenceState` covers seed / self-read / one reconcile after mount, and `createDevicePreferenceContext` wraps it for cross-component consumers. The load-bearing asymmetry is kept: `parse` is total while `readCookie` is nullable, so "never chosen" stays distinguishable from "chose the default" and the reconcile's guard still works; a present-but-invalid cookie parses to the default rather than counting as never-chosen. The setter accepts a functional updater, which ticket 19's toggle needs. The library's `recipe-view-mode.ts` is now one `defineDevicePreference` declaration, its context a `createDevicePreferenceContext` call, and the dashboard's duplicate Tabs-key parse rides `preference.parse`. There were no existing library view tests to keep passing (the cookie move landed without any); the new unit suites cover parse fallback, round trip, all three provider paths, functional updates and the outside-provider throw, and a dev-server check shows the server HTML selecting the stored tab per cookie value.
