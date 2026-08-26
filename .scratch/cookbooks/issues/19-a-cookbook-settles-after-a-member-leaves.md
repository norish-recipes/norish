# 19 — A cookbook settles after a member leaves

**What to build:** Taking a recipe out of a cookbook left the card describing it: the count dropped, but the cover, the description, the total time and the smallest serving all still came from the departed member, and stayed that way. Fixes a defect in `13` and in `04`.

**Status:** ready-for-human

- [x] The cookbook realtime subscription is actually mounted — it was written, exported and never called, so no cookbook echo had ever reached a client and spec story 38 (a housemate's change showing on your screen) had never worked
- [x] It hangs above every surface that shows a cookbook, because the Library is not mounted while a reader is on a recipe filing into one
- [x] A membership change invalidates the lists on success as well, so the reader who made it does not need realtime to be up to watch their own cookbook settle
- [x] Unfiling clears everything the card derives from the members, none of which the client can recompute: which cover image was the departing recipe's, which name to strike, how much of the total time was its, and what the smallest serving is once it is gone
- [x] Filing keeps them — every member they describe is still there, so they are merely incomplete until the echo adds the newcomer
- [x] Verified in a browser: the count, the time and the description all settle within half a second without leaving the Library
