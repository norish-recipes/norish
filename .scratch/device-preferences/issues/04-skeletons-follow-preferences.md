# 04: Skeletons drawn with the reader's choices

**What to build:** Loading states take the shape of the page the reader will actually get. A reader who hid the rating or Nutrition Information sees a recipe skeleton without those placeholders. A reader who views groceries by recipe, or ungrouped, sees the grocery skeleton drawn that way. Nothing in a skeleton appears only to vanish when the page arrives. The work reads the existing preference hooks, so it works whether the choices live in cookies (before 03) or on the profile (after). See `.scratch/device-preferences/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The recipe skeleton, in its phone and desktop layouts, leaves out the rating placeholder when the rating is a Hidden Item, and the nutrition placeholder when Nutrition Information is. Everything else stays as it is.
- [x] The grocery skeleton is drawn in the reader's view (by store or by recipe) and grouping.
- [x] The library skeleton and Today's meals are unchanged.
- [x] The first-paint browser tests, with JavaScript turned off, prove that:
  - [x] a recipe page with the rating and Nutrition Information hidden arrives without either placeholder;
  - [x] one with nothing hidden arrives with both;
  - [x] the groceries page arrives with a by-recipe skeleton when that view is stored.

  The tests seed choices the way the first-paint tests do at the time: cookies before 03, the API after.
