# 05 — The `@` mention gesture, and retiring inline linkification

**What to build:** Typing `@` while writing a step opens ingredient autocomplete; picking an entry inserts the plain word into the sentence and attaches the chip beneath the step. The `@` never reaches stored text. The render-time `@`-token linkification is deleted everywhere — legacy tokens in existing recipes read as the literal text they always were on mobile — and the editor's formatting help stops teaching the old syntax.

**Blocked by:** 04 — Step editor chips.

**Spec:** `.scratch/general-improvements/spec.md`

**Status:** done

- [x] `@` opens ingredient autocomplete in step text; picking inserts the plain word and attaches a chip with a full share.
- [x] Stored step text never contains `@` tokens produced by the gesture.
- [x] The `@` trigger respects word boundaries (no trigger mid-word or in email-like text).
- [x] The inline linkification pass is removed from both the private and public renderers; legacy tokens display literally.
- [x] The editor formatting help teaches the mention gesture instead of the `@` syntax, in every shipped locale.
- [x] The `/` recipe-link and `#` heading affordances are unaffected.

## Comments

- Shipped in f96b15c6. @ inserts the plain word and attaches a full-share chip atomically; word-boundary trigger keeps email-like text plain; the linkification pass, the norish-ingredient scheme, and the tap-to-highlight chain are deleted from private and public renderers (legacy tokens read literally, no migration); the formatting help teaches the gesture in all 13 locales; / and # untouched.
