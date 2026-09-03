# 04 — File a recipe into a cookbook

**What to build:** From a recipe's quick actions menu, a reader opens a panel listing every cookbook they may edit with this recipe's membership shown as a toggle, so the same place both files and unfiles. A row at the top makes a new cookbook holding this recipe in one step. Every recipe page gains a card at the bottom naming the cookbooks it is in, or inviting the reader to file it when it is in none — and readers who do not use cookbooks can hide that card, per device, like any other **Hidden Item**.

Filing requires only that the reader can see the recipe and edit the cookbook. The recipe itself is never written (ADR-0027).

**Blocked by:** 03 — there must be cookbooks to file into.

**Status:** ready-for-agent

- [ ] A recipe may belong to several cookbooks, and adding the same recipe twice changes nothing
- [ ] Filing requires view rights on the recipe and edit rights on the cookbook; a reader who can see but not edit a recipe may still file it
- [ ] Filing never writes the recipe row: its version is not bumped and its owner is neither notified nor shown a change
- [ ] The panel lists only cookbooks the reader may edit, with membership as a toggle that both adds and removes
- [ ] The panel's first row creates a cookbook already holding the current recipe
- [ ] The recipe page ends with a card listing its cookbooks, each linking to that cookbook
- [ ] A recipe in no cookbook shows an invitation that opens the same panel
- [ ] The card is a Hidden Item with a per-device switch beside the existing visibility preferences, and hiding it affects only the recipe page, never the Library or the chips
- [ ] Deleting a recipe removes it from every cookbook it was in, leaving those cookbooks in place even when that empties them
- [ ] A cookbook that loses its last recipe survives with its title intact
- [ ] Database seam test: membership is unique on its pair, and deleting a recipe cascades its membership without removing cookbooks
- [ ] Router seam test: the permission rule, and that no membership mutation writes the recipe row
- [ ] All new strings exist in 14 locales; `pnpm i18n:check` passes
