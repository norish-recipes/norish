# 03: Icons on the other recipe surfaces, the share page and the Hidden Item

**What to build:** Every recipe surface shows Ingredient Icons, the same way the recipe page's lines do:

- cooking mode;
- a step's ingredient chips;
- recipe editor rows, as soon as the typed name matches a known food;
- the signed-out share page.

A reader can hide all icons on their device as a Hidden Item. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Cooking mode and step chips read the icon through their recipe line's food.
- [ ] Editor rows find their food through the existing `ingredients.find` (which never mints), then read the icons query. A row that matches nothing shows the placeholder.
- [ ] The share page's public lines carry the icon address itself, resolved on the server by the same service. The share page still exposes no ids.
- [ ] The Hidden Item `ingredientIcons` ("Ingredient icons") hides every icon, the placeholder and its slot included, on that device, in the app and on the share page. The hidden-items provider is mounted on the share layout from the same cookie, as the amount display already is.
- [ ] Translations for the new strings in every locale.
- [ ] Tests:
  - [ ] the share DTO carries icon addresses and no ids;
  - [ ] the Hidden Item hides the component;
  - [ ] the hidden-items preference test is updated.
