# 08 — Overlays on photos and media go solid

**What to build:** The chips and controls that sit on a recipe photo or over a video become opaque objects rather than tinted windows onto the picture. A cooking time on a bright plate and a Tag on a dark pan are both legible, because the object carries its own contrast instead of borrowing whatever is behind it.

This is the half of ADR-0020 that needs judgment rather than mechanical replacement, and it is the half a narrower rule would have spared — which is exactly why it was rejected. A blurred scrim over a moving picture is the least stable surface to put a control on.

**Blocked by:** 01 (warm theme tokens).

**Status:** ready-for-agent

- [ ] Chips on a library card's photo — rating, time, servings — render as opaque surface-filled objects with a shadow, in place of white text on a tinted scrim.
- [ ] Tag chips over a recipe photo do the same, and allergy Tags keep their warning fill, which was already carrying its weight with colour rather than with blur.
- [ ] The heart button, the author chip and the floating recipe chip are opaque.
- [ ] Lightbox, video player and carousel controls are solid near-black, and the cooking mode step image controls follow.
- [ ] Every one of these is checked against both a bright photo and a dark one, in both themes.
- [ ] No blur utility or see-through fill remains on any of them.
