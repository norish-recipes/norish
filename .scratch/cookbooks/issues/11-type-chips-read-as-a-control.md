# 11 — The three type chips read as a control

**What to build:** All / Recipes / Cookbooks were three small chips, two of which read as ghosts. They are a lens that renames the page and changes what the Add button makes, so they are sized as a control. Amends the chip presentation in `02`.

**Status:** ready-for-human

- [x] Larger: `lg`, a 36px target, real horizontal padding
- [x] The unlit chips take a real fill and a border, so the group reads as three choices with one taken
- [x] `.chip--on-ground` covers `secondary` as well as `tertiary`, so the fill still separates from the page ground
- [x] The lit chip keeps the accent fill
- [x] `data-library-type` is unchanged, so nothing that addresses them breaks
