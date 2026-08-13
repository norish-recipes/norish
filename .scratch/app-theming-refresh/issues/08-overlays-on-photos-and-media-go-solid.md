# 08 — Overlays on photos and media go solid

**What to build:** The chips and controls that sit on a recipe photo or over a video become opaque objects rather than tinted windows onto the picture. A cooking time on a bright plate and a Tag on a dark pan are both legible, because the object carries its own contrast instead of borrowing whatever is behind it.

This is the half of ADR-0020 that needs judgment rather than mechanical replacement, and it is the half a narrower rule would have spared — which is exactly why it was rejected. A blurred scrim over a moving picture is the least stable surface to put a control on.

**Blocked by:** 01 (warm theme tokens).

**Status:** done

- [x] Chips on a library card's photo — rating, time, servings — render as opaque surface-filled objects with a shadow, in place of white text on a tinted scrim.
- [x] Tag chips over a recipe photo do the same, and allergy Tags keep their warning fill, which was already carrying its weight with colour rather than with blur.
- [x] The heart button, the author chip and the floating recipe chip are opaque.
- [x] Lightbox, video player and carousel controls are solid near-black, and the cooking mode step image controls follow.
- [x] Every one of these is checked against both a bright photo and a dark one, in both themes.
- [x] No blur utility or see-through fill remains on any of them.

## Comments

- Implemented on `feat/improve-styling-and-consistency` (working tree; Mike commits). Library card chips (rating/time/servings/options), Tag chips over photos, the heart button, the author chip, Today's meal-slot chips and the floating recipe chip are opaque with their own shadow; allergy Tags keep the warning fill. The heart's icon colours went theme-aware (`text-muted`/red) since it now sits on a surface fill. Lightbox, video, carousel and cooking-mode step controls are solid near-black through a new shared `cssMediaControl` token in `config/css-tokens.ts`.
- Two review catches folded in: the video progress track was still `bg-white/30` (now solid `bg-neutral-700`, hover overlay dropped), and the recipe editor gallery overlays (`image-gallery-input`, `media-gallery-input`: drag handles, order/duration badges, play overlay) were see-through fills with no blur — swept to solid under ADR-0020, since ticket 14's blur-only test would never have caught them.
- Checked against bright and dark photos in both themes via the screenshot pass (library grid light+dark, recipe hero, lightbox computed styles).
