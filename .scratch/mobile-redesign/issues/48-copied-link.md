# 48: The copied-link row on a real iPhone

**What to build:** The add-recipe sheet's "Import ‹host›" row shows for links copied from real apps. See spec Part 7 ("Recipes tab").

**Blocked by:** none

**Status:** ready

- [ ] Reproduced on Mike's iPhone with links copied from Safari, Instagram and Notes; which ones fail recorded here.
- [x] `useCopiedLink` asks `UIPasteboard.detectPatterns(for: [.probableWebURL])` through a local Expo module (no prompt), then reads the link (prompts as today). Own-server links still skipped.
- [x] Unit test for the decision (done); the fix seen on the device for every source that failed.

## Comments

- Decided: `expo-clipboard` 58.0.4 has no pattern detection, so a local module `apps/mobile/modules/pasteboard-link` (iOS only; `requireOptionalNativeModule` is null on Android, which keeps `hasUrlAsync`) answers `hasProbableWebUrl`; `.gitignore` got `!apps/mobile/modules/*/ios` because `**/ios` swallowed it. After detection the hook reads `getUrlAsync()`, else `getStringAsync()`, since a link copied as text has no URL item. `copiedLinkToOffer` is unchanged and gained tests for text links and sentences.
- Simulator (iPhone 18 Pro, iOS 27.2, Release, `simctl pbcopy`, which can only set plain text, so "copied as a URL" was not testable): link as text and the own-server link ran `detectPatterns` with no prompt; non-link text ran it and read nothing. But for the link-as-text case the read failed at once with "Operation not authorized" and no prompt, so the row never showed; I could not tell a simulator limit from a real fault.
- Left for Mike's iPhone: the reproduction (Safari, Instagram, Notes) and whether the row shows after the real "Allow Paste" prompt, with a link copied as a URL and as text.
- Review round 1 (Standards + Spec), dispositions:
  1. fix: the two added tests restate cases `copiedLinkToOffer` already had; what changed (detection, its fallback, what is read) has no test. The flow becomes a testable function and gets the tests.
  2. fix: a link copied as text is read twice (`getUrlAsync` returns nil, then `getStringAsync`), so a refused paste prompt comes back a second time. One read.
  3. fix: `.probableWebURL` also matches a link inside a sentence and a link without a scheme, so iOS prompts and no row shows. Whatever makes detection say yes yields a row: the first web link in the text, `https://` added to a bare one. (My call; the spec does not settle it.)
  4. fix: a native module that rejects returns false instead of falling back to `hasUrlAsync`; caught errors go to the app's logger if the app has one for this.
  5. fix: the un-ignore rule moves from the root `.gitignore` to `apps/mobile/.gitignore`.
  6. fix: the four-level relative import into `modules/`; the one-line JS binding lives where `@/` reaches it.
  7. fix: podspec template residue (empty author and source, tvOS floor, globs for languages the module lacks).
  8. fix (verify on the simulator): "Operation not authorized" with no prompt. Check Settings › Norish › Paste from Other Apps, then copy inside the simulator from Safari (a URL) and from Notes (text).
  9. reject: a clipboard changed while the sheet stays open is not picked up; unchanged behaviour, not this ticket.
  10. reject: a written convention for local native modules; nobody asked, and one module is not a pattern yet.
- Review round 1 fixes, simulator (iPhone 18 Pro, iOS 27.2, Release, Notes is not installed so plain text was copied from Safari's address bar). The simulator cannot show the paste prompt: `pasted` logs "Paste requires user authorization. Prompting...", then tccd "service not protected: kTCCServicePasteboard" and the read fails with "Operation not authorized" under Ask. So Allow and Deny were set in Settings › Norish › Paste from Other Apps instead; the prompt itself stays for Mike's iPhone.
- Allow: a URL copied from Safari's address bar, the same link as text, a sentence holding a link, and a bare `example.com/...` each showed "Import ‹host›" (https:// added to the bare one); a link to the dev server showed no row. Deny: link as text and sentence showed no row. The log shows one pasteboard read per sheet open, so the string read covers a copied URL.
- Review round 2 (the fix range), dispositions:
  1. fix: the hand-written link search is wrong on real text: an uppercase scheme gets a second `https://`, a closing bracket in a path is cut, curly quotes stay on the link, `notes.txt` or `Node.js` counts as a bare domain and wins over the real link, a non-ASCII domain is cut, a port is dropped. iOS already knows which link it detected: the module returns `detectValues(for: [.probableWebURL])` and the search goes. Off iOS the old rule stays (the whole text is the link).
  2. fix: `isWebLink` is case-sensitive, so a scheme that is not lowercase is not seen as one.
  3. fix: `copiedLinkToOffer`'s `hasUrl` parameter is always true in the app.
  4. fix: tests for the cases in 1 and 2.
  5. reject: a read in flight finishing after the sheet closes; a pasteboard read cannot be cancelled and the state guard is already there.
- Review round 2 fixes (aa10efadb, 42c55f524), simulator (iPhone 18 Pro, iOS 27.2, Release, copied in Safari via a local page's `navigator.clipboard.writeText`). `detectValues(for: [.probableWebURL])` (iOS 14+) returns the detected link as a String; under Ask it logs "Paste requires user authorization. Prompting..." like a string read, `detectPatterns` does not; under Deny it fails with code 13 and no row shows.
- Allow, row offered (full link read from "From a link"): recipe URL → that URL; `…/Pasta_(food)` → whole link; curly-quote sentence → none (`detectPatterns` says no); `see notes.txt then https://example.com/r` → `https://example.com/r`; `example.com/recipe` → `https://example.com/recipe`; `HTTPS://EXAMPLE.COM/a` → kept as is; plain text → none; `http://localhost:3000/recipes/abc` (own server) → value read, none. Setting set back to Ask.
