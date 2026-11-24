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
