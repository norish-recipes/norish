# 15: Add recipe and imports

**What to build:** The Add recipe sheet behind the accessory with its copied-link row and the link, text and photo imports. See `.scratch/mobile-redesign/spec.md` Part 2 ("Add recipe and imports") and the HomeAdd board plus ticket 07's import boards.

**Blocked by:** 14

**Status:** done

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

### Review log (2026-11-13)

Implementation `bc8db6dc0..53166ba9c` on Opus medium (the offline requirement), fixes `cd77298d4..2e6db2a00`. Standards on Sonnet low and Spec on Opus medium (the diff changed three lines of offline code, so not the high-effort review); the implementer and the fixer checked on the iPhone 18 Pro in light and dark.

Fixed:
- One toast for the whole app in the board's shape, in the platform adapter: an icon circle by severity, title, body and an optional action; the imported toast names the recipe; a toast with an action stays 8 seconds. Measured 12 pt from each side, 62-64 pt tall, a 40 pt circle and View pill. `cdf77cd02`, `755982fef`, `6864c9d3a`, `1c893bfb9`
- A failed import is titled "Import failed" on both apps (an existing unused key). `779076fc2`
- "AI import" in sentence case; a sheet's secondary action is heroui-native's tertiary variant, visible on glass and on the opaque full-height sheet. `3237ed088`, `ccbea0d44`
- The four import paths share one start-and-close hook and one actions component; one link-stripping helper; the photo grid sizes from the sheet's exported inset; the picker's alert ids live under `common.photos`. `e347f3e64`, `4ceb726dc`, `04d0d7ebc`, `9b0c2f67b`

Checked, no change needed: imports already queue through the Outbox on both apps; a queued link or text import is one entry written at queue time, a photo import's files are copied to the documents folder and removed when the entry leaves the Outbox (success, discard, sign-out), a retry keeps them; killed within a second of queueing and again after six, there was one pending card each time and one recipe after replay; the clipboard is read once per sheet open and only after `hasUrlAsync()`; the return key and the button share one start-once guard; web's imports behave as before and the deleted web test's six cases are in the shared test.

Rejected: treating the same server under another scheme or hostname as the own server for the copied-link row; sharing mobile's "a link that opens" rule with web (web's rule requires a dotted host and checks its own page address).

Asked: the toast's pill sits on an opaque fill, not glass. heroui-native draws toasts in a separate window so they stay above sheets, and `@expo/ui`'s native glass drew nothing inside it. Glass there needs a toast layer of our own.

Not seen on a device: the copied-link row (the iOS 27.2 simulator's pasteboard stays empty after `simctl pbcopy`, a reboot and Safari's Copy; unit-tested only, needs a real iPhone); the camera; a failed write's toast; the secondary button at full height in light; the photo and text imports after the refactor; the 10-photo cap and the over-long text refusal (unit-tested).

Commit `cdf77cd02`'s message says "glass pill"; `755982fef` replaced the glass with the fill.

Final state `2e6db2a00`: all 11 gates exit 0 with the tests uncached, mobile lint has no warnings.

### Follow-up (2026-11-14)

Mike: the toast's icon circle is too large, "almost half the size". The board draws 40 pt with a 20 pt glyph and the app matches it; the app goes to a 24 pt circle with a 14 pt glyph. Done in `05e10a69d`: the pill's left padding went from 12 to 20 pt so the smaller circle clears the curve.

Mike, 2026-11-14, on the asked glass toast: the opaque pill is fine. Closed; no toast layer of our own.
