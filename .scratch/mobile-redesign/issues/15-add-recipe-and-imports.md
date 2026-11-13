# 15: Add recipe and imports

**What to build:** The Add recipe sheet behind the accessory with its copied-link row and the link, text and photo imports. See `.scratch/mobile-redesign/spec.md` Part 2 ("Add recipe and imports") and the HomeAdd board plus ticket 07's import boards.

**Blocked by:** 14

**Status:** open

- [x] Moved first, in separate commits, web switched over with its unit tests: the toasts and stay/navigate rule of `use-import-recipe.ts` (importing, already exists with Open), the image checks and `MAX_OCR_FILES` cap of `import-from-image-modal.tsx`, the paste length check.
- [x] `expo-clipboard` added through `expo install`. On open, `hasUrlAsync()`; with a link, read it and show "Import ‹host›" as the first row; own-server links skipped. From a link opens pre-filled.
- [x] From a link, From text; From photos (AI only) with several images from library or camera, uploads as `expo-file-system` files (`importRecipeFromImages` widened); Write it yourself to a placeholder route.
- [x] Imports show the pending card and the View / failure toasts on every tab; offline imports queue.
- [x] The sheets are glass with no solid footer.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Offline: web already queues all three imports through the universal Outbox link, and so does mobile, unchanged: a queued link or text import is one MMKV entry written synchronously at admission (never the throttled cache save) and replays once a probe says Live. A queued photo import copies each picked file into `Documents/outbox-uploads/<seq>-<n>.<ext>` before the entry is stored, keeps only the file name (iOS moves the container), and deletes the copies when Replay removes the entry, on success or discard. One fix was needed: a native expo-file-system `File` lost its name and type when the adapter spread it (`fix(mobile): keep a queued native file's name and type`). Checked on the device: queued with the server stopped (offline toast + pending card), app killed and relaunched (card still there), server started, the import replayed.
- Moved: `useImportRecipe` (toasts, stay/go-home) and the AI paste cap (`isPasteTooLong`) to shared-react; `refuseOcrImage`/`fitOcrCap` to `@norish/shared/lib/ocr-images`. Web keeps its "too many" toast when the set is already full. Mobile shows the paste cap and image refusals inline or in an alert, as a toast sits behind a native sheet. Mobile imports `stay` on the tab they started from.
- Every Add recipe sheet presents from the root stack, so it opens over any tab; picking a way replaces the Add recipe sheet. From text is the 62%/full sheet, the rest fit their content. The shared glass close button got a small size for the photo tiles.
- Not seen on the device: the copied-link row. This iOS 27.2 simulator's pasteboard stays empty (`simctl pbcopy`, then `pbinfo`: "Pasteboard is empty", also after a reboot and after Safari's Copy), so `hasUrlAsync` answers false; the decision is unit-tested. Also unseen: the 100,000-character state (the driver can't type it), the camera (simulator), and the board's toast look: the shared heroui-native toast has no check circle or recipe name.
- Labels: buttons reuse web's "AI Import" (the board says "AI import").
