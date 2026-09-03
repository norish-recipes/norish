# 23 — One select control, and a cookbook that says it is clickable

**What to build:** Small consistency work across the panels and the card. Amends `21` and `22`.

**Status:** ready-for-human

- [x] A cookbook card takes the pointer cursor a recipe card already had — it navigates, and said nothing about it
- [x] Its quick actions read plus, edit, delete, on the card and in the cookbook page's own menu, so the two cannot disagree
- [x] The cookbook panels use the app's round select box rather than a second one drawn by hand, so ticking a cookbook and ticking a grocery animate the same way
- [x] The groceries panel moves its own tick to the right, where every other selectable row in the app puts it
- [x] The whole row stays the target: the checkbox is told apart from the row it sits in, or a tap on the control would toggle twice — the containment guard that made that work moves next to the control it is about
