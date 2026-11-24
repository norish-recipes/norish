# 09: Settings rows: long press only

**What to build:** Mike, with ticket 08's build on his iPhone (2026-11-24): "The swipe actions are wrong, they appear inline with the row instead of outside and it looks off. Also there is no commit animation like recipes has, perhaps just remove it and keep only the long press." Settings rows lose their swipe. The recipe cards' swipe goes back to exactly what it was before ticket 08.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] No Settings row swipes: site tokens, API keys, share links, household members, sign-in methods. Every action stays in the row's long-press menu, in the order ticket 08 set (the red removing action last), with the confirms they had.
- [ ] No swipe code is left for Settings: components, the row size variant, the "asks first" full-swipe rule, swipe-only labels and i18n keys, tests, testIDs.
- [ ] The recipe swipe's files are back in `apps/mobile/src/features/recipes` and identical to `ab7684c8f` (`git diff ab7684c8f HEAD -- apps/mobile/src/features/recipes` shows nothing in the swipe, its helpers, the card or their tests).
- [ ] VoiceOver still reaches every row action; Offline, a row's menu is still empty.
- [ ] Maestro: the Settings flows use the long-press menu; the recipe swipe flows still pass.
- [ ] Gates green.

Docs: `apps/docs/docs/mobile.md` says "Swipe a row to see its actions, or touch and hold it"; Terra corrects it after the code.

## Comments
