# 15 — Feature docs and release notes

**What to build:** The change is documented for the people who will read about it rather than build it. Hidden Items is the only part that needs teaching — the rest is a look, which a reader meets rather than learns — so the documentation leads with what a reader can now turn off and what stays when they do.

The repo's definition of done requires every feature PR to update the Target Version's release notes and the docs site.

**Blocked by:** 12 (hide provenance, nutrition and notes), 14 (design invariants suite). (13 was a blocker until it closed wontfix on 2026-08-14 — the release notes describe the sign-in refresh without a hand-over.)

**Status:** done

- [x] The documentation explains Hidden Items: what can be hidden, that everything is shown by default, that hiding is that reader's own view and changes nothing about the recipe or what other household members see, and that the origin flag beside a title stays when Recipe Provenance is hidden.
- [x] It uses the glossary's vocabulary — Recipe Provenance, Nutrition Information, Hidden Item — and does not use the word "Macros".
- [x] Screenshots showing the settings control and a slimmed recipe page are captured and included, following the repo's existing screenshot conventions.
- [x] The Target Version's release notes cover the warm ground, the chip rule, the removal of glass, the new bottom bar, the sign-in refresh, the HeroUI upgrade and Hidden Items.
- [x] The release notes say plainly that the three previous display switches were replaced by the new control and that anyone who had ratings or favourites hidden will need to hide them again — there is deliberately no migration.
- [x] No environment variables were added, so nothing is needed in the environment example, the configuration page or the upgrade notes.
- [x] The documentation site's own theme is knowingly left on the old cool values and is not re-ported here.

## Comments

- Shipped. New docs page `recipes/hidden-items.md` (position 5 in the Recipes category) teaches Hidden Items in the glossary's vocabulary: the seven hideable items, everything shown by default, hiding as the reader's own view, the signed-out/share-link reader seeing everything, and the origin-flag exception. Screenshots captured live against the dev server with Mike's account (preferences staged in the dev DB and restored afterwards): the Preferences card with three items selected (`hidden-items-settings.png`) and the slimmed Dutch-baby recipe page whose title keeps its origin flag while Recipe Provenance, Nutrition Information and notes are absent (`hidden-items-recipe.jpg`, JPEG per the photo-heavy precedent). The Target Version notes (0.21.0-beta) gained a Features section covering the warm ground, the chip rule, the removal of glass, the solid bottom bar, the HeroUI 3.2.4 move, the sign-in refresh (described without a hand-over, per 13's wontfix) and Hidden Items, plus the first-paint promise; Upgrade notes state the display switches were replaced with deliberately no migration. No environment changes. Docs `pnpm format` and production `pnpm build` both pass inside the standalone workspace; the docs site's own cool theme left untouched.
