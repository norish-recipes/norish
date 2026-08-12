# 14 — Design invariants suite

**What to build:** The contract step. By now nothing in the web app imports the shared glass tokens, so they are deleted — and a test is added that fails if blur, those tokens, or the handrolled segmented control ever come back.

Their absence is the enforcement. With no shared token to reach for, re-adding glass means writing it out by hand, and the test catches that too. This makes ADR-0020 permanent instead of a thing a reviewer has to notice, and it proves the Tabs migration actually finished rather than leaving the old control beside its replacement.

**Blocked by:** 06 (view switch on Tabs), 07 (chrome solid), 08 (media solid), 09 (bottom bar).

**Status:** ready-for-agent

- [ ] The four shared glass tokens are deleted, and nothing imports them.
- [ ] A test reads the web app's own source and fails if any blur utility or `backdrop-filter` appears in it.
- [ ] The same test fails if the glass tokens are reintroduced.
- [ ] The same test fails if the handrolled segmented control reappears.
- [ ] The test's failure messages say why the rule exists and point at ADR-0020, so someone hitting it understands rather than deletes the assertion.
- [ ] Modal backdrops that dim the page are not caught by the rule — a scrim over content is allowed; a surface pretending to be a material is not.
- [ ] Prior art for a test that reads repo source and fails on drift is the existing quality-gates suite.
- [ ] The suite is somewhere the repo's own lint and test gates actually reach.
