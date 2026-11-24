# 09: Settings rows: long press only

**What to build:** Mike, with ticket 08's build on his iPhone (2026-11-24): "The swipe actions are wrong, they appear inline with the row instead of outside and it looks off. Also there is no commit animation like recipes has, perhaps just remove it and keep only the long press." Settings rows lose their swipe. The recipe cards' swipe goes back to exactly what it was before ticket 08.

**Blocked by:** 08

**Status:** done

- [x] No Settings row swipes: site tokens, API keys, share links, household members, sign-in methods. Every action stays in the row's long-press menu, in the order ticket 08 set (the red removing action last), with the confirms they had.
- [x] No swipe code is left for Settings: components, the row size variant, the "asks first" full-swipe rule, swipe-only labels and i18n keys, tests, testIDs.
- [x] The recipe swipe's files are back in `apps/mobile/src/features/recipes` and identical to `ab7684c8f` (`git diff ab7684c8f HEAD -- apps/mobile/src/features/recipes` shows nothing in the swipe, its helpers, the card or their tests).
- [x] VoiceOver still reaches every row action; Offline, a row's menu is still empty.
- [x] Maestro: the Settings flows use the long-press menu; the recipe swipe flows still pass.
- [x] Gates green.

Docs: `apps/docs/docs/mobile.md` says "Swipe a row to see its actions, or touch and hold it"; Terra corrects it after the code.

## Comments

### Implemented (2026-11-24, 9f3cf76ce, c0a5484f0)

- One `git revert` of ticket 08's nine code commits (bb46d30c6's order kept), then a commit deleting Settings' older swipe that the revert brought back: `swipeable-row`, `swipe-actions-panel` and its test, `swipeActions`, `swipeLabel` and the short captions, the tone's swipe `ground`/`ink`. No i18n key was swipe-only. `git diff ab7684c8f HEAD -- apps/mobile/src/features/recipes apps/mobile/src/lib/open-row.ts apps/mobile/__tests__` is empty.
- A row with actions shows nothing extra: Settings had the swipe from its first commit (d675084ae), so there was no earlier hint to keep; the long press lifts the row. VoiceOver reaches the actions through the NativeMenu button, as before ticket 08 (not run with VoiceOver on).
- `settings-token-delete.yaml` long-presses the row, Delete, Cancel, then again and confirms. The eight named flows passed once each on a Release simulator build; a sideways drag on a member, API key, share link and site token row does nothing. Sign-in method rows not seen: the Maestro account has only a password.
