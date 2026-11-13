# 15: Add recipe and imports

**What to build:** The Add recipe sheet behind the accessory with its copied-link row and the link, text and photo imports. See `.scratch/mobile-redesign/spec.md` Part 2 ("Add recipe and imports") and the HomeAdd board plus ticket 07's import boards.

**Blocked by:** 14

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: the toasts and stay/navigate rule of `use-import-recipe.ts` (importing, already exists with Open), the image checks and `MAX_OCR_FILES` cap of `import-from-image-modal.tsx`, the paste length check.
- [ ] `expo-clipboard` added through `expo install`. On open, `hasUrlAsync()`; with a link, read it and show "Import ‹host›" as the first row; own-server links skipped. From a link opens pre-filled.
- [ ] From a link, From text; From photos (AI only) with several images from library or camera, uploads as `expo-file-system` files (`importRecipeFromImages` widened); Write it yourself to a placeholder route.
- [ ] Imports show the pending card and the View / failure toasts on every tab; offline imports queue.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
