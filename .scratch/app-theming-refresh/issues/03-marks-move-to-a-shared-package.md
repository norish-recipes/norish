# 03 — Ingredient marks move to a shared package

**What to build:** Prefactor, so the sign-in work becomes an easy change. The five small ingredient line drawings the landing uses in its quiet margins — the sprig, mushroom, tomato, pear and lemon — become available to the web app as well as the landing, from one definition. Nothing changes on the landing: same drawings, same slow turn, same draw-on-scroll, same parallax.

The web app cannot use the scroll machinery — a sign-in page does not scroll — so the shared piece has to work without it. A drawing with nothing driving it should simply be finished and drawn, which is already how the landing behaves for a reader without scripting.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The five drawings live in a shared package that both the landing and the web app can import.
- [ ] The rules that draw a stroke and turn a mark live beside the shared theme tokens rather than in the landing's own stylesheet.
- [ ] The landing renders identically to before: drawings appear in the same places, still draw themselves when scrolled to, still turn slowly, still travel their own share of the page.
- [ ] A drawing rendered with nothing driving it is fully drawn rather than blank, so a consumer with no scroll context gets a finished drawing.
- [ ] Reduced motion still stands the movement down, as it does on the landing today.
- [ ] The web app is not yet using them; this ticket only makes them reachable.
