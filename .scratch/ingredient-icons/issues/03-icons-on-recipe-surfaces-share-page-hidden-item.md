# 03: Icons on the other recipe surfaces, the share page and the Hidden Item

**What to build:** Every recipe surface shows Ingredient Icons, the same way the recipe page's lines do:

- cooking mode;
- a step's ingredient chips;
- recipe editor rows, as soon as the typed name matches a known food;
- the signed-out share page.

A reader can hide all icons on their device as a Hidden Item. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 01

**Status:** done, pending gates and review

- [x] Cooking mode and step chips read the icon through their recipe line's food.
- [x] Editor rows find their food through the existing `ingredients.find` (which never mints), then read the icons query. A row that matches nothing shows the placeholder.
- [x] The share page's public lines carry the icon address itself, resolved on the server by the same service. The share page still exposes no ids.
- [x] The Hidden Item `ingredientIcons` ("Ingredient icons") hides every icon, the placeholder and its slot included, on that device, in the app and on the share page. The hidden-items provider is mounted on the share layout from the same cookie, as the amount display already is.
- [x] Translations for the new strings in every locale.
- [x] Tests:
  - [x] the share DTO carries icon addresses and no ids;
  - [x] the Hidden Item hides the component;
  - [x] the hidden-items preference test is updated.

## Comments

2026-10-06 (implementation): cooking mode and the steps' chips read the recipe page's one icons read (a provider around the page); the editor's rows find their food with `ingredients.find` once typing pauses (`useFoodsByName`), reading the name the way Save will. The share DTO's lines gain `icon` (an address or null), filled by `getPublicRecipeView` through a resolver the share procedure passes, so the repository stays out of the ingredient module. The Hidden Item and its translations landed with ticket 01, since the icon component reads it.
