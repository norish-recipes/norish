# 51: Sheet header

**What to build:** `modal-header.tsx` as the board header on every panel: glass close or back, title with optional subtitle (Move: "Hoisin Chicken"), one glass secondary icon (several become one menu), glass prominent primary with accent tint and white label, plain glass when disabled. See any board in /private/tmp/claude-501/-Users-mike-Documents-norish/d38bec8b-911e-4dc6-bbb1-96fe9e0bbaac/scratchpad/boards, e.g. move.png, editItem.png.

**Blocked by:** 50

**Status:** ready

- [ ] Subtitle support, used where the boards show one.
- [ ] The primary renders as the native prominent bar item with the accent tint (not a solid capsule, not untinted); disabled = plain glass.
- [ ] No sheet paints its own header strip; the system scroll edge effect stays.
- [ ] Tests for the subtitle and the menu/secondary split; gates green.

## Comments
