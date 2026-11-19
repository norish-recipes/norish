# 51: Sheet header

**What to build:** `modal-header.tsx` as the board header on every panel: glass close or back, title with optional subtitle (Move: "Hoisin Chicken"), one glass secondary icon (several become one menu), glass prominent primary with accent tint and white label, plain glass when disabled. See any board in /private/tmp/claude-501/-Users-mike-Documents-norish/d38bec8b-911e-4dc6-bbb1-96fe9e0bbaac/scratchpad/boards, e.g. move.png, editItem.png.

**Blocked by:** 50

**Status:** done

- [x] Subtitle support, used where the boards show one.
- [x] The primary renders as the native prominent bar item with the accent tint (not a solid capsule, not untinted); disabled = plain glass.
- [x] No sheet paints its own header strip; the system scroll edge effect stays.
- [x] Tests for the subtitle and the menu/secondary split; gates green.

## Comments

- Native bar API has no title subtitle, so `ModalHeader` takes `subtitle` and renders a two-line `headerTitle` view (17 semibold foreground, 12.5 muted, one line each) only when it is set; `Sheet` forwards it and no longer paints a body line.
- The enabled prominent primary gets `tintColor` accent; disabled sets none (plain glass). Scroll-edge effect untouched.
- `SheetRow`/`TITLE_INSET` stay (add-to-groceries aligns rows with the title inset); the centred title no longer lines up with them, ticket 53 should revisit.
- Tests extend the existing modal-header suite; no device check (ticket 55).
