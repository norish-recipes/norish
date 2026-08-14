# 15 — Feature docs and release notes

**What to build:** The change is documented for the people who will read about it rather than build it. Hidden Items is the only part that needs teaching — the rest is a look, which a reader meets rather than learns — so the documentation leads with what a reader can now turn off and what stays when they do.

The repo's definition of done requires every feature PR to update the Target Version's release notes and the docs site.

**Blocked by:** 12 (hide provenance, nutrition and notes), 14 (design invariants suite). (13 was a blocker until it closed wontfix on 2026-08-14 — the release notes describe the sign-in refresh without a hand-over.)

**Status:** ready-for-agent

- [ ] The documentation explains Hidden Items: what can be hidden, that everything is shown by default, that hiding is that reader's own view and changes nothing about the recipe or what other household members see, and that the origin flag beside a title stays when Recipe Provenance is hidden.
- [ ] It uses the glossary's vocabulary — Recipe Provenance, Nutrition Information, Hidden Item — and does not use the word "Macros".
- [ ] Screenshots showing the settings control and a slimmed recipe page are captured and included, following the repo's existing screenshot conventions.
- [ ] The Target Version's release notes cover the warm ground, the chip rule, the removal of glass, the new bottom bar, the sign-in refresh, the HeroUI upgrade and Hidden Items.
- [ ] The release notes say plainly that the three previous display switches were replaced by the new control and that anyone who had ratings or favourites hidden will need to hide them again — there is deliberately no migration.
- [ ] No environment variables were added, so nothing is needed in the environment example, the configuration page or the upgrade notes.
- [ ] The documentation site's own theme is knowingly left on the old cool values and is not re-ported here.
