# 23: Recipe editor

**What to build:** The recipe editor, for editing and for Write it yourself. See `.scratch/mobile-redesign/spec.md` Part 3 ("Editor") and the RecipeEdit board.

**Blocked by:** 20

**Status:** open

- [x] Moved first, in separate commits, web switched over: `use-unsaved-navigation-guard` and the editor logic web keeps in `recipe-editor-screen.tsx`.
- [x] Full screen, glass close, Save or Create as the bottom pill; cards in the page's order; a row per ingredient with a grip; `#` sections; the `@` ingredient popup in steps; photos from the library or camera.
- [x] The error state, and the discard alert when leaving with changes.
- [x] Write it yourself opens it in place of the placeholder.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: Moved: the guard's state and ask-then-leave (web keeps `beforeunload`/Backspace on top), the form, rows, `#`/`@` logic, payload and dirty check (`isDirtyState` to `@norish/shared/lib`); web's untouched-recipe payload is pinned by a test written before the move. Decided beyond the ticket, for both apps: an untouched ingredient row keeps its stored line instead of being re-parsed, and step references follow a reordered or removed line (before, a reorder silently re-pointed `@` chips on web too). Mobile: a mention attaches at the full share and a chip's share is set from an action sheet (no amount ask); no `/` recipe links or photo reordering; removing a photo deletes it at once, as on web; `@formatjs/intl-displaynames` added because Hermes has no `Intl.DisplayNames` (the country list was empty).
- Offline: create and edit queue through the Outbox like every recipe write; photos need a connection (Add photo says so), since the form must hold an upload's address and a queued upload has none.
- Simulator (iPhone 18 Pro, iOS 27.2, light and dark): Write it yourself with a `#` section, `@` references picked from the popup, a reorder by the grip (chips kept their lines), a library photo; created, opened on the Recipe screen, edited and saved; the DB rows matched (web's page not opened, I can't sign in there); an untouched save left every line unchanged; discard alert on close and back swipe; error ring; focused fields and the `@` popup stay above the pill and keyboard; throwaway deleted. Fixed on the way: nested lists swallowing page scrolls, the popup opening under the pill. Not seen: camera, offline save, step photos. Maestro flows (spec) not written. Ticket 30: docs for the editor and Edit, a release note for the web reference fix.
