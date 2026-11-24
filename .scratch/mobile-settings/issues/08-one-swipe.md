# 08: One swipe for recipe cards and Settings rows

**What to build:** Mike, on his iPhone (2026-11-24): the Settings swipe actions look always shown, the canvas specced them badly, and they should work like the recipe cards' swipe. Settings rows stop having their own swipe (`settings/components/swipeable-row.tsx`, `swipe-actions-panel.tsx`) and use the one recipe cards use (`recipes/components/swipe-actions.tsx`, `recipes/utils/swipe-reveal.ts`, `lib/open-row.ts`), moved to where both features may import it.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] One swipe component serves recipe cards and every Settings list (site tokens, API keys, share links, household members, sign-in methods): the same gesture, look, full swipe, one open row at a time, Reduce Motion handling. Settings' own swipe files are gone.
- [ ] Nothing of a row's actions shows until it is swiped (his build predates `b0a0de0dd`, which hid the circles; check it on the simulator in light and dark).
- [ ] Every state change is a swipe action: Revoke and Reactivate (share links), Disable and Enable (API keys), Kick and Make admin (members), Unlink (sign-in methods), Delete. Copy stays in the long-press menu only.
- [ ] Order in one place, tested: the red action that removes something (Delete, Kick, Unlink) is always last, as Delete is on a recipe card, and it is the full-swipe action; a confirm still asks before it acts. The long-press menu lists the same order.
- [ ] Offline, a Settings row does not open (as now).
- [ ] Recipe cards behave as before: their Maestro flows that swipe still pass.
- [ ] Gates green.

Supersedes the spec's Lists line "small swipe actions (34 pt circles, 11 pt labels)": the recipe cards' swipe is the design.

## Comments
### Decision before implementation (2026-11-24, gatekeeper; Mike can overrule)

The implementer stopped on a missing decision: the recipe swipe's action (a 48 pt circle with its label under it, about 71 pt) does not fit a 64 pt Settings row or a 50 pt member row, and the swipe clips to the row's height. Chosen: the recipe list look unchanged, and every row of a Settings list whose rows can have actions is at least 76 pt tall (all rows of that list, so a list never mixes heights). The size is one variant of the shared swipe, so "no labels" (44 pt circles on the rows' present heights) stays a small change if Mike prefers it.

Settled with it: the swipe moves to `src/components/swipe-actions.tsx` and `src/lib/swipe-reveal.ts`, each action carrying its icon, colour and whether the row stays open under a confirm; one ordering function in `row-actions.ts` (the red removing action last, Copy in the menu only) used by the swipe and the long-press menu; a Settings row's red action closes the row and asks, without the card's slide-away.

### Mike's decision (2026-11-24), replacing the size chosen above

Rows keep their present heights. The circles are smaller, sized to what the row has room for, without labels under them (the spoken label stays). What must match the recipe cards is the animation and behaviour: the reveal, the stretch, the full swipe, one open row at a time, Reduce Motion. He also believes more row actions than the two he named are drawn always visible: every Settings list is checked for an action shown as a permanent control on a row, and each becomes a swipe action.
