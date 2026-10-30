# 44: Joined foods a person once parented are split

**What to build:** Found by the audit of ticket 31's final run (2026-10-22, `m31c_post_on`). 29 own foods (38 lines) are still one joined food: "yellow or red onion", "Dijon or yellow mustard", "lamb/beef mince", "kookroom/slagroom", "stevia or sweetener", "sperziebonen of kousenband".

**The causes.**

- **AI never read them.** All 29 have a 0.25 `parent_chosen`, so the pass skipped them (ticket 40). No reading of any of them is in the log, so no split was refused and no food was read as one.
- **The first start's word split could not take any of them.** `partsByWordsOf` (`resolver.ts`) needs a joining word and every part known by rungs 1–2:
  - 9 join with "/", which is a joining word in no language: lamb/beef mince, lemon/lime juice, molasses / brown sugar.
  - 9 share a head or a tail word, so one part names no food alone: "yellow", "Dijon", "thigh", "rode-", "black".
  - 11 have a part the catalogue lacks: "stevia", "rawits", "kousenband", "droge sherry", "oud broodkruim".
- **AI reads these shapes right.** In the same run it split "cilantro / green onion", "crème fraîche / sour cream" and "sticky or sushi rice", each part written whole.

**Fix:** no rule of its own.

- Ticket 40 lets AI read them.
- Ticket 41's shared words split 5 of them with AI off: yellow or red onion, white or red onion, Dijon or yellow mustard, chicken breast or thigh, rode- en witte kool.
- "/" stays AI's to read. It often joins two names for one food ("coriander / cilantro", "beef stock / broth", "sereh/citroengras"), and splitting at it would make two foods out of one.

**Blocked by:** 40, 41

**Status:** ready-for-agent

- [ ] On a rerun of ticket 31's measurement with 40 and 41, none of the 29 is left as one food unless AI read it as one; any that is, is listed here with AI's reading.
