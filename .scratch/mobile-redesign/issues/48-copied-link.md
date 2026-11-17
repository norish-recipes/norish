# 48: The copied-link row on a real iPhone

**What to build:** The add-recipe sheet's "Import ‹host›" row shows for links copied from real apps. See spec Part 7 ("Recipes tab").

**Blocked by:** none

**Status:** ready

- [ ] Reproduced on Mike's iPhone with links copied from Safari, Instagram and Notes; which ones fail recorded here.
- [ ] `useCopiedLink` asks `UIPasteboard.detectPatterns(for: [.probableWebURL])` through a local Expo module (no prompt), then reads the link (prompts as today). Own-server links still skipped.
- [ ] Unit test for the decision; the fix seen on the device for every source that failed.
