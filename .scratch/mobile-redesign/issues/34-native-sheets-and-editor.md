# 34: Native sheet headers and editor

**What to build:** Native headers on every sheet and on the recipe editor. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Sheets and the editor").

**Blocked by:** none

**Status:** done

- [x] Every sheet (`components/sheet.tsx` users) shows the native sheet header: system title, native glass close, Save as a confirm item where the sheet saves. Hand-built titles and `GlassCloseButton` go, and the extra back buttons in `recipe-servings-screen.tsx` and `cookbook-title-sheet.tsx`.
- [x] The recipe editor (new and edit, its loading and not-found states) gets a native header with Close and Save; its absolute top bar and Save pill go.
- [x] A sheet's content height change animates instead of jumping.
- [x] Maestro flows updated where they tapped the hand-built buttons.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- One `ModalHeader` (`components/modal-header.tsx`) declares title, a glass Close (`xmark`; a Back chevron for a step inside a sheet) and a prominent confirm item through `Stack.Screen` header items; `Sheet` renders it (`confirm`, `back` props) and the editor's `EditorFrame` wraps it in all four states (new, edit, loading, not found). A confirm without `onPress` is disabled; the header's Close goes back by default. Sheet routes get `headerShown` with a transparent header background, so the glass shows through.
- Decided: confirm = a sheet that commits its own fields (planned-item note, add/edit grocery, pantry food, store editor, rename, pick sheets, Repeat's and the product step's Done, Add to groceries' Add). Verb buttons (Apply, Import, Plan, Share, Delete, Remove, Type the price) stay pinned. The servings Done and the Cancel buttons went. The system title has no subtitle, so a subtitle is a muted line above the body.
- The native header items carry no identifier in the accessibility tree (checked on the simulator), so the Maestro flows tap `Close`, `Create`, `^Add$` and `Add 1 recipe` by their exact label (add-to-groceries, cookbook-create-add and plan-from-today run green on the simulator). Add to groceries' header confirm reads plain Add; the count is in the list.
- The editor's country and cuisine lists are the `editor-choice` sheet route: name, title and mode ride the route params, the choices and onChange cross in a one-shot slot (`choice-request.ts`) that the sheet empties when it takes it and the editor clears on unmount. Its search is the shared `SheetSearchField`, as in the pick sheets. `GlassCloseButton` stays for photo and cook-mode buttons.
- Height animation: a fit sheet animates on its own. Recorded Import from a link gaining its error line: the sheet's top moved over about 0.4 s in nine eased frames, no jump. Nothing was added.
- The tab bar, its accessory and the recipe page's bottom bar showed blurred through the sheets' glass; every `Sheet` flags itself open while mounted (`lib/tab-bar-visibility.ts`), which hides the tab bar and the page's bar, so there is no route list to keep. Recorded on Groceries (frames in the scratchpad `t34/round2/`): the bar fades out before the sheet slides up, the page behind does not move, the bar returns as the sheet slides down, and a cancelled swipe leaves it hidden.
- A link to a missing recipe's Servings or Share sheet threw "Recipe not loaded" (predates this ticket); both now show the not-found state. The Recipe page and the editor already did, with Back or Close.
- Simulator (iOS 27.2, own :3400, light; dark where marked): Add groceries (light, dark), its Store and Repeat steps (Back, Done), Add saved; Edit grocery (light, dark); Manage stores and the store editor (Create saved); Pantry food (Save); New cookbook (Create saved), Add recipes (Add saved), Rename (Save saved); Add to cookbook (Save saved); Add to groceries (Add saved); Plan; plan-recipe; planned item; Import from a link; the editor's country list (pick returns); the editor's loading and not-found states; swipe-down on the planned item. Unseen: the grocery product step (needs a shop link), Import photos (not offered with AI off), the editor's cuisine list (no cuisines on the server), dark mode of the cookbook, pantry, plan and planned-item sheets. PNGs are in the scratchpad `t34/`.

### Review log (2026-11-16)

Range `13f2cbe28..aee64b3e4`. Standards on Sonnet low, Spec on Opus medium; implemented and fixed on Sonnet medium; three fix rounds, the first two checked on an iOS 27.2 simulator; reviewed three times.

Fixed, first review (15): the photo-choice sheet's hand-built bar (now the `editor-choice` sheet route); the product step's Done and Add to groceries' Add moved to the header; a back chevron on nested steps; the dead identifier plumbing (native header items carry no id); the confirm wrapper and the editor header's three placements; names, comments and unnamed numbers; an unused i18n key; the unopened sheets opened on the simulator; a missing recipe's Servings and Share sheets throwing (predates the ticket, test first); the tab bar and the recipe page's bar showing through a sheet's glass.

Fixed, second review (12): the hand-kept sheet path list and the `useIsFocused` check (sheets flag themselves open); Add to groceries' confirm reads plain Add; the header's default close and one confirm item; the choice slot clearing and its params on the route; one sheet search field; the recipe sheet gate rendering the one Sheet; root sheets declared one way; Maestro's Add taps anchored and run.

Fixed, third review (4): one counter store for the two tab-bar flags; one inset; `useMarkSheetOpen`; the `multiple` param parsed beside its encode.

Closed after checking: a fit sheet's height change already animates (recorded: about 0.4 s, nine eased frames); the disabled confirm keeps a no-op `onPress` because the native item type requires one.

For the maintainer to judge: Filters' Apply and the Import, Plan, Share, Delete and Remove buttons stay pinned rather than becoming header confirms; the cookbook sheet's confirm keeps its count ("Add 1 recipe").

Not seen on the simulator: the grocery product step (needs a shop link), Import photos (AI off), the editor's cuisine list (no cuisines on the test server), dark mode for most sheets, the bar hiding under a sheet on Calendar (recorded on Groceries only).

Final state `aee64b3e4`: all 11 gates exit 0, mobile lint has no warnings.
