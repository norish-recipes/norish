# 14 — Design invariants suite

**What to build:** The contract step. By now nothing in the web app imports the shared glass tokens, so they are deleted — and a test is added that fails if blur, those tokens, or the handrolled segmented control ever come back.

Their absence is the enforcement. With no shared token to reach for, re-adding glass means writing it out by hand, and the test catches that too. This makes ADR-0020 permanent instead of a thing a reviewer has to notice, and it proves the Tabs migration actually finished rather than leaving the old control beside its replacement.

**Blocked by:** 06 (view switch on Tabs), 07 (chrome solid), 08 (media solid), 09 (bottom bar).

**Status:** done

- [x] The four shared glass tokens are deleted, and nothing imports them.
- [x] A test reads the web app's own source and fails if any blur utility or `backdrop-filter` appears in it.
- [x] The same test fails if the glass tokens are reintroduced.
- [x] The same test fails if the handrolled segmented control reappears.
- [x] The test's failure messages say why the rule exists and point at ADR-0020, so someone hitting it understands rather than deletes the assertion.
- [x] Modal backdrops that dim the page are not caught by the rule — a scrim over content is allowed; a surface pretending to be a material is not.
- [x] Prior art for a test that reads repo source and fails on drift is the existing quality-gates suite.
- [x] The suite is somewhere the repo's own lint and test gates actually reach.

## Comments

- Shipped. The four `cssGlassBackdrop*` tokens are gone from `config/css-tokens.ts` (nothing imported them since ticket 07), and `apps/web/__tests__/design-invariants.test.ts` reads the app's shipped source and fails on any `backdrop-blur`/`backdrop-filter`, any blur utility, any reintroduced glass token, or the segmented control coming back (the real deleted names — `components/ui/segment.tsx`, `SegmentRoot` — plus the likely reinvention spelling). Failure messages carry the full ADR path. Three decorative empty-state glows still used `blur-3xl` (filter blur, not glass); they now draw the same halo with a `bg-radial` gradient, so "any blur utility" holds without a carve-out. The walk skips build output, tests and stray nested trees, and asserts it saw enough files that a broken walk cannot read as green — same guard-the-guard shape as the quality-gates suite. `turbo run test` reaches it through `@norish/web`'s test script; verified red on a planted `backdrop-blur-sm`. Lint ignores `__tests__` repo-wide (same as the quality-gates prior art); prettier, the typecheck and the Tests gate all reach it.
