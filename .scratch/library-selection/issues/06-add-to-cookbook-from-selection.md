# 06: Add to cookbook from a selection

**What to build:** an **Add to cookbook** action in the action bar.
- **The panel** is modelled on MiniCookbooks: every cookbook the reader may edit, several can be picked, plus a row that names a new cookbook.
- **On save:** a named new cookbook is created with the selection through `cookbooks.create` with `recipeIds`, and the selection is added to each picked existing cookbook through the bulk add.
- **Permissions:** recipes the reader may only view can be filed, and recipes already in a cookbook stay without duplicating.
- **Afterwards:** the selection clears, and a toast names how many recipes went where, with an **Open** action. Open goes to the new cookbook, or to the first picked one.

See `.scratch/library-selection/spec.md`.

**Blocked by:** 02, 03.

**Status:** ready-for-agent

- [ ] E2E: search "pasta" and select some, search "pizza" and select more, file all into a new cookbook; Open lands on it with every recipe in it
- [ ] E2E: filing into an existing cookbook that already holds one of the recipes leaves one membership
- [ ] Toast copy is terse and translated
- [ ] Gates green
