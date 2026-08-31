# 25 — The Add button makes either kind under All

**What to build:** Under **All** the Library holds recipes and cookbooks together, and the Add button could only make one of them. It offers both now. Amends `03`'s chip-aware button.

**Status:** ready-for-human

- [x] Under **All** the menu gains **Cookbook** beside the recipe entries, and the button drops to a plain **Add** — "Add Recipe" with a Cookbook inside it would be lying about the shorter half of itself
- [x] Under **Recipes** nothing changes: the menu is recipes only, because that is all the list can show
- [x] Under **Cookbooks** nothing changes: still the one-tap **+ Cookbook**
- [x] The menu closes before the panel opens, so its items cannot rebuild mid-exit and steal focus from the panel
- [x] Creating from here behaves exactly as it does under the Cookbooks chip — it leaves the reader on the Library (`16`)
- [x] ADR-0026's pairing still holds: the button is only honest because the chip that decides its meaning is permanently on screen beside a heading that names it
- [x] Browser E2E: the button reads Add under All and makes a cookbook, and offers no Cookbook under Recipes
