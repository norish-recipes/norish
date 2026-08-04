# 07 — Documentation and release notes tell the truth

**What to build:** A self-hoster reading the release notes for the Target Version learns what
actually shipped, and a self-hoster following the import troubleshooting guidance is sent
somewhere real. One entry in the uncommitted rewrite claims the reported downloader version is
the one the image ships — which is false on every existing install until ticket 06 lands.

**Blocked by:** 03, 04, 05, 06.

**Spec:** `.scratch/import-and-provider-fixes/spec.md`

**Status:** ready-for-agent

Last by design: this ticket describes what the others did, so it cannot be written accurately
until they are done.

- [ ] The downloader-version release entry describes what shipped — a live report of the binary
      the server runs, shown read-only — rather than claiming the displayed value was already
      correct.
- [ ] The meal-planning entry matches how far ticket 05 actually reached. If the fault proved
      general, say so; if it was only the slot menu, do not imply more.
- [ ] The import troubleshooting guidance points at a field that is now real, and says what to
      do when it reports no binary.
- [ ] Copy pass across the rewritten notes: the missing word in the provenance summary, the
      em-dash opened at "Newer models" and closed with a comma, the missing full stop after the
      temperature entry, and "Need" where "New" is meant.
- [ ] The docs build is green **and** the AI provider page renders as separate sections rather
      than one callout. Ticket 01 closed the admonition; confirm against the rendered output,
      because the build passes either way and nothing else would catch a regression.
- [ ] Every enrichment kind the notes list matches what the code actually offers.

## Comments
