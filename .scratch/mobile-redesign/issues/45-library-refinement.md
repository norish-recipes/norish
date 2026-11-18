# 45: Library switch, tags and swipe

**What to build:** A view switch that doesn't remount, tags that fit, Mail-style swipe. See spec Part 7 ("Recipes tab").

**Blocked by:** none

**Status:** ready

- [x] The grid/list switch is `ListSwitch`; it flips locally at once and saves the Device Preference in the background.
- [x] One key per recipe in both views (no `grid-${index}`); no entering animation replay on a toggle.
- [x] Grid tags: those that fit plus `+N`, glass over the photo. `TagStrip`, `useTagStrip`, `tag-strip-intent` and the swipe's `requireToFail` on them go.
- [x] Swipe actions fan out with the finger, each at its own rate; full swipe runs the first. Unit test for the offsets.
- [x] Gates green; checked on the device.

## Comments

- No "tags that fit" rule existed (web shows 2 then +N, the mobile list 1 then +N), so `fitTags` is new: chips are measured once in a hidden row, the grid uses it, the list keeps its first-tag rule.
- The view is `useLibraryView`: a module-scope pick shown at once and saved in the background, kept if the save fails; both views now render the same 8-card cells (`cell-N` keys, one key per recipe), so a toggle remounts nothing (`card-list.test.tsx`).
- Swipe: action `i` of `n` moves at `(n-i)/n` of the finger (first glued to the card, outer ones lag), one block under Reduce Motion; a full swipe is 80% of the *screen* (60% of a grid card was reached by Maestro's swipe and ran the first action).
- Device (iOS 27.2, Release): thumb visible in dark on the Library and Groceries; Planned item and Plan recipe sheets not checked there. The agent-device screenshot lags the last tap by a frame, so mid-motion shots are of the settled state. Reduce Motion can't be set through the device tools: covered by the unit test only. Cookbook page not walked (shares the header and list). `decay-to.ts` went with the tag strip.
