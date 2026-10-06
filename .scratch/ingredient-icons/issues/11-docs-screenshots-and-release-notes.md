# 11: Docs, screenshots and release notes

**What to build:** The Ingredient Icon feature documented for users and self-hosters, shot with the real set. See `.scratch/ingredient-icons/spec.md` and `docs/agents/feature-docs.md`.

**Blocked by:** 09, 10

**Status:** docs and release notes done; screenshots wait on 09

- [x] A docs page on ingredient icons covers:
  - [x] where icons show;
  - [x] the order a food's icon is picked in;
  - [x] upload and Generate in the panel;
  - [x] the Draw icons round;
  - [x] that Generate needs an image provider.
  
  It has screenshots of a recipe page, the grocery list and the panel.
- [x] The Hidden Items page lists "Ingredient icons".
- [x] The AI provider page notes that icons use the Image Generation provider at its cheapest quality, and that the icon style is an editable Prompt.
- [x] The Target Version's release notes get an entry. There are no new environment variables.
- [ ] Screenshots come from a scratch docs-screenshots spec, as for the Pantry page. It is not part of the gate.

## Comments

2026-10-06 (implementation): the page is `apps/docs/docs/groceries/ingredient-icons.md`; Hidden Items, the AI provider page and the 0.25.0-beta release notes are updated, and the docs build passes. **Still open: the screenshots.** They wait for ticket 09's real set, since the placeholder shapes would only mislead a reader; take them then from a scratch docs-screenshots spec, as for the Pantry page, and embed them in the page.
