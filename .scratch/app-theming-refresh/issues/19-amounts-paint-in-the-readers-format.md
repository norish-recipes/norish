# 19 — Amounts paint in the reader's format

**What to build:** Ingredient amounts render in the reader's chosen format — fractions or decimals — from the first frame. Today the choice lives in localStorage, so a decimal reader opens a recipe, sees ½ and ¾ paint, and watches them flip to 0.5 and 0.75 a frame later. The amount-display toggle even carries a hand-rolled hydration placeholder (a disabled stand-in button) purely to hide its own version of this flicker.

The preference moves onto a device-preference cookie. The shared hook keeps its current interface so every consumer — the readonly ingredients list, the per-step ingredient rows, the toggle — is untouched; only the web storage binding underneath changes. Mobile has its own native binding and is not part of this ticket.

**Blocked by:** 16 (one helper for device-preference cookies).

**Status:** ready-for-agent

- [ ] With decimals stored, the HTML the server sends for a recipe page carries decimal amounts; no fraction is ever painted.
- [ ] The toggle reflects the stored choice on first paint, and its hydration placeholder is deleted — the flicker it papered over no longer exists.
- [ ] Toggling re-renders every visible amount immediately and the choice survives reload and restart.
- [ ] A navigation answered by the service worker's cached HTML, and the offline bootstrap, both settle on the cookie's current choice.
- [ ] No fallback read of the old localStorage key: a decimal reader picks decimals once more and it sticks.
- [ ] The mobile app's amount display behaviour and storage are untouched.
- [ ] Page-level tests assert server-rendered amounts for both formats, and the existing ingredient-list suites keep passing.
