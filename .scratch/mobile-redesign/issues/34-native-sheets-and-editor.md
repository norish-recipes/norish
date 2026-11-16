# 34: Native sheet headers and editor

**What to build:** Native headers on every sheet and on the recipe editor. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Sheets and the editor").

**Blocked by:** none

**Status:** open

- [x] Every sheet (`components/sheet.tsx` users) shows the native sheet header: system title, native glass close, Save as a confirm item where the sheet saves. Hand-built titles and `GlassCloseButton` go, and the extra back buttons in `recipe-servings-screen.tsx` and `cookbook-title-sheet.tsx`.
- [x] The recipe editor (new and edit, its loading and not-found states) gets a native header with Close and Save; its absolute top bar and Save pill go.
- [ ] A sheet's content height change animates instead of jumping.
- [x] Maestro flows updated where they tapped the hand-built buttons.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- One `ModalHeader` (`components/modal-header.tsx`) declares title, a glass Close (`xmark`) and a prominent confirm item through `Stack.Screen` header items; `Sheet` renders it (new `confirm` prop) and the editor's `EditorHeader` wraps it in all four states. Sheet routes get `headerShown` with a transparent header background, so the glass shows through (an opaque header drew a cream strip).
- Decided: confirm = a sheet that commits its own fields (planned-item note, add/edit grocery, pantry food, store editor, rename, pick sheets, Repeat's Done). Verb buttons (Apply, Import, Add to groceries, Plan, Delete, Remove) stay pinned. The servings Done and the Cancel buttons went. The system title has no subtitle, so a subtitle is a muted line above the body. Native items have no testID: Maestro taps `Close`, `Create`, `Add.*` by text (unrun, ticket 30).
- Deviations: the editor's `ChoiceSheet` is an RN `Modal`, not a route, and keeps its hand-built bar and `GlassCloseButton`. `GlassCloseButton` stays for photo and cook-mode buttons. The `@` popup's pill-avoidance context was deleted with the pill.
- Height animation is unchecked: react-native-screens already animates a fit sheet's detent (`animateChanges`), nothing was added, box left open.
- Simulator (iOS 27.2, own :3400, light and dark): Filters, Add recipe, import link/text, editor new/edit (Create/Save saved; discard alert from Close), Servings, Share, Add groceries (Add saved), Edit grocery with Repeat step (Done), keyboard, swipe-down. Unseen: plan, cookbook, stores, pantry, planned-item, add-to-groceries sheets; the editor's loading and not-found states (a deep link to a missing id crashes the Recipe page under it with "Recipe not loaded", not this ticket's code).
