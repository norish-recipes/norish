# 34: Native sheet headers and editor

**What to build:** Native headers on every sheet and on the recipe editor. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Sheets and the editor").

**Blocked by:** none

**Status:** open

- [ ] Every sheet (`components/sheet.tsx` users) shows the native sheet header: system title, native glass close, Save as a confirm item where the sheet saves. Hand-built titles and `GlassCloseButton` go, and the extra back buttons in `recipe-servings-screen.tsx` and `cookbook-title-sheet.tsx`.
- [ ] The recipe editor (new and edit, its loading and not-found states) gets a native header with Close and Save; its absolute top bar and Save pill go.
- [ ] A sheet's content height change animates instead of jumping.
- [ ] Maestro flows updated where they tapped the hand-built buttons.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
