# 45: Library switch, tags and swipe

**What to build:** A view switch that doesn't remount, tags that fit, Mail-style swipe. See spec Part 7 ("Recipes tab").

**Blocked by:** none

**Status:** ready

- [ ] The grid/list switch is `ListSwitch`; it flips locally at once and saves the Device Preference in the background.
- [ ] One key per recipe in both views (no `grid-${index}`); no entering animation replay on a toggle.
- [ ] Grid tags: those that fit plus `+N`, glass over the photo. `TagStrip`, `useTagStrip`, `tag-strip-intent` and the swipe's `requireToFail` on them go.
- [ ] Swipe actions fan out with the finger, each at its own rate; full swipe runs the first. Unit test for the offsets.
- [ ] Gates green; checked on the device.
