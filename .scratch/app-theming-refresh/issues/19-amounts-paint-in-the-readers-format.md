# 19 — Amounts paint in the reader's format

**What to build:** Ingredient amounts render in the reader's chosen format — fractions or decimals — from the first frame. Today the choice lives in localStorage, so a decimal reader opens a recipe, sees ½ and ¾ paint, and watches them flip to 0.5 and 0.75 a frame later. The amount-display toggle even carries a hand-rolled hydration placeholder (a disabled stand-in button) purely to hide its own version of this flicker.

The preference moves onto a device-preference cookie. The shared hook keeps its current interface so every consumer — the readonly ingredients list, the per-step ingredient rows, the toggle — is untouched; only the web storage binding underneath changes. Mobile has its own native binding and is not part of this ticket.

**Blocked by:** 16 (one helper for device-preference cookies).

**Status:** done

- [x] With decimals stored, the HTML the server sends for a recipe page carries decimal amounts; no fraction is ever painted.
- [x] The toggle reflects the stored choice on first paint, and its hydration placeholder is deleted — the flicker it papered over no longer exists.
- [x] Toggling re-renders every visible amount immediately and the choice survives reload and restart.
- [x] A navigation answered by the service worker's cached HTML, and the offline bootstrap, both settle on the cookie's current choice.
- [x] No fallback read of the old localStorage key: a decimal reader picks decimals once more and it sticks.
- [x] The mobile app's amount display behaviour and storage are untouched.
- [x] Page-level tests assert server-rendered amounts for both formats, and the existing ingredient-list suites keep passing.

## Comments

- Shipped. The preference is a `defineDevicePreference` declaration (`lib/amount-display.ts`) behind a context mounted twice — in the app shell (seeded by the `(app)` layout's server pass) and in a new server layout for the share route, the other surface that renders amounts — and self-reading on the offline bootstrap. `useAmountDisplayPreference` keeps its exact `{ mode, setMode, toggleMode }` interface, so every consumer and every existing test mock is untouched; only the binding underneath moved from the shared factory + localStorage to the cookie context (mobile keeps the factory over MMKV, untouched). All visible amounts re-render together on toggle because every consumer now shares one context state — previously each hook instance had its own localStorage copy. The toggle's disabled hydration stand-in is deleted; the stored mode is in the first render on every path. One reading note: recipe data is client-fetched, so "the HTML the server sends carries decimal amounts" holds as: the seeded mode rides the server pass into the first render, and the first amounts ever painted are already in the stored format — there is no post-hydration flip, which the harness asserts on the first painted DOM. `hooks/use-local-storage.ts` lost its last consumer and is deleted. Ingredient-list suites pass untouched; the new hook suite covers seed, self-read, toggle round trip and explicit set.
