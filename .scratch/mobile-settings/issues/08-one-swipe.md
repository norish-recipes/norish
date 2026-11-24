# 08: One swipe for recipe cards and Settings rows

**What to build:** Mike, on his iPhone (2026-11-24): the Settings swipe actions look always shown, the canvas specced them badly, and they should work like the recipe cards' swipe. Settings rows stop having their own swipe (`settings/components/swipeable-row.tsx`, `swipe-actions-panel.tsx`) and use the one recipe cards use (`recipes/components/swipe-actions.tsx`, `recipes/utils/swipe-reveal.ts`, `lib/open-row.ts`), moved to where both features may import it.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] One swipe component serves recipe cards and every Settings list (site tokens, API keys, share links, household members, sign-in methods): the same gesture, look, full swipe, one open row at a time, Reduce Motion handling. Settings' own swipe files are gone.
- [x] Nothing of a row's actions shows until it is swiped (his build predates `b0a0de0dd`, which hid the circles; check it on the simulator in light and dark).
- [x] Every state change is a swipe action: Revoke and Reactivate (share links), Disable and Enable (API keys), Kick and Make admin (members), Unlink (sign-in methods), Delete. Copy stays in the long-press menu only.
- [ ] Order in one place, tested: the red action that removes something (Delete, Kick, Unlink) is always last, as Delete is on a recipe card, and it is the full-swipe action; a confirm still asks before it acts. The long-press menu lists the same order.
- [x] Offline, a Settings row does not open (as now).
- [x] Recipe cards behave as before: their Maestro flows that swipe still pass.
- [x] Gates green.

Supersedes the spec's Lists line "small swipe actions (34 pt circles, 11 pt labels)": the recipe cards' swipe is the design.

## Comments
### Decision before implementation (2026-11-24, gatekeeper; Mike can overrule)

The implementer stopped on a missing decision: the recipe swipe's action (a 48 pt circle with its label under it, about 71 pt) does not fit a 64 pt Settings row or a 50 pt member row, and the swipe clips to the row's height. Chosen: the recipe list look unchanged, and every row of a Settings list whose rows can have actions is at least 76 pt tall (all rows of that list, so a list never mixes heights). The size is one variant of the shared swipe, so "no labels" (44 pt circles on the rows' present heights) stays a small change if Mike prefers it.

Settled with it: the swipe moves to `src/components/swipe-actions.tsx` and `src/lib/swipe-reveal.ts`, each action carrying its icon, colour and whether the row stays open under a confirm; one ordering function in `row-actions.ts` (the red removing action last, Copy in the menu only) used by the swipe and the long-press menu; a Settings row's red action closes the row and asks, without the card's slide-away.

### Mike's decision (2026-11-24), replacing the size chosen above

Rows keep their present heights. The circles are smaller, sized to what the row has room for, without labels under them (the spoken label stays). What must match the recipe cards is the animation and behaviour: the reveal, the stretch, the full swipe, one open row at a time, Reduce Motion. He also believes more row actions than the two he named are drawn always visible: every Settings list is checked for an action shown as a permanent control on a row, and each becomes a swipe action.

Correction from Mike, same day: the label stays. A Settings row's swipe action is styled like a recipe card's (a circle with the icon, the text beneath), only smaller, so circle and label fit the row's present height. No icon-only variant.

### Implemented (2026-11-24, b0959249c, bb46d30c6, f0a773898)

- The `row` variant is the list's look scaled to fit a 50 pt row: 30 pt circles, a 3 pt gap, a 10 pt caption, 60 pt slots. The caption shrinks to fit instead of ellipsizing; Make admin and Delete link keep their short captions ("Admin", "Delete"), and VoiceOver still reads the full label.
- A full swipe on a row with one action (site tokens) runs Delete, which closes the row and asks. Maestro's element swipe is a full swipe, so `settings-token-delete.yaml` now covers Cancel and then confirm. The swipe testIDs are `<row testID>-swipe-<kind>`.
- Audit: no Settings list row draws a permanent action. Join code, Leave, Add token/key and Link provider are the rows' own taps. The allergy chips' × and the profile's Delete photo are permanent, but they aren't list rows, so they stay as they are.
- Left unticked: Unlink has no confirm, on mobile or web, so a full swipe unlinks at once. Adding one needs new strings in every locale: Mike to decide. Unlink was not seen on the simulator because the Maestro account has only a password.

### Review (2026-11-24, `ab7684c8f..6b97fa27e`; Standards Haiku, Spec Opus medium): dispositions

Sound per the Spec reviewer: the order and the full-swipe action on every list (table in its report), the audit (no row action is a permanent control), recipe cards unchanged, worklet order, the long-press lift, the recipe flows' selectors.
- fix, bug: a full swipe on a sign-in method unlinks it with no confirm (`sign-in-methods.tsx:132`); the old Settings swipe had no full swipe. A full swipe runs only an action that asks first; a row whose last action does not ask just opens.
- fix: the 10 pt caption has no cap on Dynamic Type (`swipe-actions.tsx:118`), so at accessibility sizes it can outgrow a 50 pt row and be clipped.
- fix: a row already open when the connection drops keeps pressable circles (the write is blocked, the buttons are not).
- fix: the three-line comment at `swipe-actions.tsx` ~234; a comment naming Settings in the shared component (line 39); `fits` → a name that says it shrinks the caption; the recipe card's per-key branches (`ink`, `holdsOpen` in `recipe-card.tsx`) into `RECIPE_SWIPE_LOOKS`; the row-action to `SwipeAction` mapping out of `settings-row.tsx`'s render into `row-actions.ts`; the test that only echoes a prop.
- verify: each size variant states its circle size twice (a class and a number); one source if the class need not be static.
- reject: the parallel look maps of recipes and Settings (features may not import each other; the reviewer agrees).
- reject: Settings rows may now overshoot to the right (the same component as the cards, which is what was asked).
- docs: the Settings swipe text in `mobile.md` and the release notes is checked against the new behaviour by Terra after the fix.
