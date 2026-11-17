# 48: The copied-link row on a real iPhone

**What to build:** The add-recipe sheet's "Import ‹host›" row shows for links copied from real apps. See spec Part 7 ("Recipes tab").

**Blocked by:** none

**Status:** ready

- [ ] Reproduced on Mike's iPhone with links copied from Safari, Instagram and Notes; which ones fail recorded here.
- [x] `useCopiedLink` asks `UIPasteboard.detectPatterns(for: [.probableWebURL])` through a local Expo module (no prompt), then reads the link (prompts as today). Own-server links still skipped.
- [ ] Unit test for the decision (done); the fix seen on the device for every source that failed.

## Comments

- Decided: `expo-clipboard` 58.0.4 has no pattern detection, so a local module `apps/mobile/modules/pasteboard-link` (iOS only; `requireOptionalNativeModule` is null on Android, which keeps `hasUrlAsync`) answers `hasProbableWebUrl`; `.gitignore` got `!apps/mobile/modules/*/ios` because `**/ios` swallowed it. After detection the hook reads `getUrlAsync()`, else `getStringAsync()`, since a link copied as text has no URL item. `copiedLinkToOffer` is unchanged and gained tests for text links and sentences.
- Simulator (iPhone 18 Pro, iOS 27.2, Release, `simctl pbcopy`, which can only set plain text, so "copied as a URL" was not testable): link as text and the own-server link ran `detectPatterns` with no prompt; non-link text ran it and read nothing. But for the link-as-text case the read failed at once with "Operation not authorized" and no prompt, so the row never showed; I could not tell a simulator limit from a real fault.
- Left for Mike's iPhone: the reproduction (Safari, Instagram, Notes) and whether the row shows after the real "Allow Paste" prompt, with a link copied as a URL and as text.
