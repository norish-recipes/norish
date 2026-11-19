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

- Review round 1 (Standards + Spec), dispositions:
  1. fix: `modal-header.tsx:180-181` evaluates `confirm.disabled || !confirm.onPress` twice; one local.
  2. fix: the header title typography (`fontSize: 17, fontWeight: "600"`) is written in `modal-header.tsx:148`, `recipes-stack.tsx:32` and `recipe-layout.tsx:41`; one shared definition (the subtitle size and the title view's max width go beside it).
  3. fix: `modal-header.test.tsx:3-6` renames RTL's `screen` to `dom` to dodge the hoisted mock; rename the mock instead.
  4. fix: Product sheet (`product-step.tsx:102-119`): title "Product" (`groceries.mobile.product`), subtitle the store's name, per board `product`.
  5. fix: Move (`move-planned-item-screen.tsx:35-43`): subtitle is the item's name only, per board `move`; drop `calendar.today.moveSubtitle` from every locale if nothing else reads it (grep web too).
  6. fix (verify): Share (`recipe-share-screen.tsx:214`) passes `t("subtitle", { recipeName })` for a key that may not exist; the subtitle is the recipe name, per board `share`.
  7. fix: sheets whose boards show no subtitle pass one: `add-to-cookbook-screen.tsx:133`, `cookbook-add-recipes-screen.tsx:41,61`, `new-cookbook-screen.tsx:39-46`, `planned-item-screen.tsx:76`; drop them (and any message key left unread).
  8. fix: `TITLE_INSET`/`SheetRow` (`sheet.tsx:30-31,113-126`) aligned rows with the removed body line; the rows in `add-to-groceries-screen.tsx` (servings row, pantry-unavailable notice) align with the card edge per board `addToGroceries`; delete `TITLE_INSET`/`SheetRow` if nothing else needs them.

Round 1 fixes:
- 1-3: one `confirmOff` local, header title style/subtitle size/max width in `lib/header-title.ts` (used by both stacks and `ModalHeader`), test mock renamed to `header`.
- 4-6: Product shows "Product" + store name; Move and Share subtitles are the item/recipe name (`RecipeSheetGate` `subtitle` is a boolean); `calendar.today.moveSubtitle` and `recipes.sharePanel.subtitle` removed from every locale (web did not read them).
- 7-8: dropped subtitles the boards don't show (and the `name`/`title` route params only they read); `SheetRow`/`TITLE_INSET` deleted, add-to-groceries rows align with the card edge.
- Exit gate on `05a010d99`: all six gates exit 0; Release build installed on Mike's iPhone 17 Pro.
