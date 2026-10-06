# 09: Draw and commit the set

**What to build:** The real shipped set. The maintainer runs the sample sheet and approves the soft-3D style (in the spirit of Samsung Food's ingredient icons) and the quality tier. The assumption to confirm is that low holds up at 64px. Then the full run is paid for, and its files and manifest are committed in place of ticket 06's placeholders. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 08

**Status:** ready-for-human

- [ ] The sample sheet is approved, or the icon Prompt's default is tuned and the sample re-run until it is. Any tuning is committed as the Prompt's shipped default.
- [ ] The tier is chosen. Expected cost is roughly $30–35 at low and $60–300 at medium, depending on the model.
- [ ] The full run (about 5,600 icons) has completed, and failures are retried or left to borrow.
- [ ] The set is committed (about 8 MB) and the placeholders are gone.
- [ ] Spot-check on a fresh dev instance: common foods show their icons, and a few minted children show their parent's.
