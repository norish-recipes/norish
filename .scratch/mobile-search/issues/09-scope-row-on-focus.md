# 09: The Search Scope row shows on focus and animates in

**What to build:** Mike, 2026-11-20, from his iPhone: the Search Scope row "should show if the search is focused and animate in nicely". The spec said "shown only while the field has text"; this replaces that line.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The Scope row shows whenever the field is focused, with or without text, and while the field has text with the keyboard down (results). It is hidden on the rested page (no focus, no text).
- [ ] It animates in and out (fade and rise from the field, the app's spring; reduced motion respected), never popping.
- [ ] In Mike's recording (2026-11-20 08:24, iPhone 17 Pro) the row is missing the whole time the keyboard is up with "Kip" typed, and shows only after confirming. On the simulator it shows with the keyboard up. Find the cause on a real-device build (keyboard height with the predictive bar, the native field's frame) and fix it; a unit test where one fits.
- [ ] The state rule and its tests say when the row shows; `spec.md`'s Search Scope line updated.
- [ ] Gates green; checked on the simulator with the software keyboard and its predictive bar, light and dark.

## Comments
