# Library selection and the action bar

Status: ready-for-agent

## Problem Statement

Everything in the Library acts on one recipe at a time. Clearing out forty bad imports means forty swipes and forty confirmations. Building a Cookbook from recipes already in the Library means opening each recipe, opening its quick actions, and filing it into the cookbook one by one. The cookbook's own "add recipes" panel helps from the other side, but only once the cookbook exists and only through a separate checklist rather than the grid the reader is already looking at. On the cookbook page, taking several recipes out is again one at a time.

## Solution

A long-press on a recipe card in the Library starts **selecting**. Taps then toggle cards instead of opening them, and a floating **action bar** takes the place of the bottom pill: the count of selected recipes, the actions, and a clear button. Mouse and keyboard users get in through a **Select** action in the card's existing swipe/ellipsis row, or by Cmd/Ctrl-clicking a card; Shift-click selects a range.

The first actions are **Add to cookbook**, which opens a panel to pick existing cookbooks or name a new one, and **Delete**. Delete confirms with a count, and deletes only the recipes the reader is allowed to delete. On a cookbook page the same bar also offers **Remove from cookbook**.

The selection survives searching and filtering, so a reader can search "pasta", pick four, search "pizza", pick three, and file all seven into a new cookbook in one go.

The action bar is a reusable component, so later bulk workflows elsewhere in the app use the same bar.

Each bulk action is one request, and offline it becomes one entry in the Outbox. A bulk delete that is replayed after others have changed the data deletes what is still unchanged, keeps what someone else edited, and says so.

## User Stories

1. As a reader on a phone, I want to long-press a recipe card to start selecting, so that I can act on several recipes without opening each one.
2. As a reader on a desktop, I want to long-press with the mouse as well, so that the gesture works the same everywhere.
3. As a reader who does not know about long-press, I want a **Select** action in the card's swipe/ellipsis row, so that I can discover selection.
4. As a keyboard user, I want to reach selection through the card's action row and toggle cards with the keyboard, so that selection is not pointer-only.
5. As a desktop reader, I want Cmd/Ctrl-click to toggle a card in or out, starting selection if I was not selecting yet, so that it works like a file manager.
6. As a desktop reader, I want Shift-click to select every card between my last clicked card and this one in on-screen order, so that I can grab a run of recipes quickly.
7. As a reader selecting, I want a tap on a card to toggle it rather than open the recipe, so that I do not leave the page by accident.
8. As a reader selecting, I want swipe, double-tap-to-favourite and the heart switched off, so that toggling a card never also favourites it or opens its row.
9. As a reader selecting, I want each selected card to look clearly selected, so that I can see what I am about to act on.
10. As a reader in the Library, I want cookbook cards dimmed and not selectable while I am selecting recipes, so that the selection holds only recipes.
11. As a reader in the Library, I want recipes that are still importing (pending cards) to be unselectable, so that I never act on a recipe that does not exist yet.
12. As a reader selecting, I want the action bar to show how many recipes are selected, so that I know the size of what I am about to do.
13. As a reader on a phone, I want the action bar to take the place of the bottom navigation while I am selecting, so that the bottom of the screen is not crowded with two pills.
14. As a reader on a desktop, I want the action bar to take the place of the floating Library pill while I am selecting, so that the layout behaves the same as on a phone.
15. As a reader on a narrow screen, I want the action bar's labels to collapse to icons while staying announced to screen readers, so that the bar fits.
16. As a reader selecting, I want a clear button in the bar, so that I can stop selecting in one tap.
17. As a desktop reader, I want Escape to stop selecting, so that I can back out quickly.
18. As a reader, I want selection to end when I deselect the last card, so that there is no empty bar to dismiss.
19. As a reader, I want selection to clear when I leave the page, so that I never come back to a stale selection.
20. As a reader building a cookbook, I want my selection to survive a search change, so that I can collect recipes from several searches.
21. As a reader, I want my selection to survive filter changes and switching between grid and list, so that adjusting the view does not lose my work.
22. As a reader, I want the count to include selected recipes that the current search hides, so that I know they are still in the selection.
23. As a reader, I want a selected recipe that someone else deletes to drop out of my selection silently, so that I never act on something gone.
24. As a reader, I want selection to end if the only selected recipe is deleted elsewhere, so that the bar never shows zero.
25. As a reader, I want **Add to cookbook** to open a panel listing every cookbook I may edit, so that I can file the selection into existing cookbooks.
26. As a reader, I want to pick several cookbooks in that panel at once, so that one action files the selection everywhere it belongs.
27. As a reader, I want to type a title in that panel to create a new cookbook holding the selection, so that making a cookbook from recipes is one step.
28. As a reader, I want recipes already in a chosen cookbook to stay there without duplicating or erroring, so that filing a mixed selection is safe.
29. As a reader, I want Add to cookbook to work on recipes I may only view, so that I can collect other people's recipes into my own cookbooks.
30. As a reader, I want a toast after Add to cookbook naming how many recipes went where, with an **Open** action, so that I can jump to the cookbook.
31. As a reader, I want the selection to clear after an action succeeds, so that the bar never lingers over a finished job.
32. As a reader, I want **Delete** to ask for confirmation naming how many recipes will be deleted, so that a mass delete is never a slip of the thumb.
33. As a reader whose selection includes recipes I may not delete, I want the confirmation to say how many will be deleted and how many will stay, so that I know exactly what happens.
34. As a reader whose selection holds no recipe I may delete, I want Delete unavailable, so that I am not offered an action that does nothing.
35. As a reader, I want deleted recipes to leave the grid with the existing delete animation, so that bulk delete feels like the single one.
36. As a household member, I want bulk delete to obey the same delete permission policy as a single delete, including Orphaned recipes being deletable by anyone, so that selection grants no new power.
37. As a reader on a cookbook page, I want the same selection and action bar, so that I can manage a cookbook's members in bulk.
38. As a reader on a cookbook page, I want **Remove from cookbook** in the bar, so that I can take several recipes out at once without deleting them.
39. As a reader on a cookbook page, I want Add to cookbook and Delete there too, so that I can copy recipes into other cookbooks or remove them for good.
40. As a reader, I want removing the last recipes from a cookbook to leave the cookbook in place, so that the title I chose survives (as with a single removal).
41. As a reader offline, I want bulk delete, Add to cookbook and Remove from cookbook to apply tentatively and queue, so that selection works without a connection.
42. As a reader offline, I want each bulk action to be one Outbox entry, so that the Outbox does not fill with forty lines for one gesture.
43. As a reader whose offline bulk delete replays after someone edited some of those recipes, I want the unchanged ones deleted and the edited ones kept, so that nobody's newer work is lost.
44. As that reader, I want a toast saying how many recipes were changed by someone else and kept, so that their reappearance is explained.
45. As a reader whose offline bulk delete includes a recipe someone else already deleted, I want that to count as done, so that the replay does not fail over something that is already gone.
46. As a reader whose offline new cookbook replays after some of its recipes were deleted, I want the cookbook created with the recipes that still exist, so that the cookbook is not lost.
47. As a reader, I want a stale delete (single or bulk) to leave the kept recipe's images intact, so that a recipe that survives is not left without its pictures.
48. As a reader on another device, I want bulk changes to arrive as Realtime Events, so that my Library and cookbooks converge without a refresh.
49. As a screen-reader user, I want the action bar announced as a toolbar with a label and its icon-only buttons labelled, so that I can use it.
50. As a reader with reduced motion, I want the bar to appear and disappear without sliding, so that it respects my setting.

## Implementation Decisions

### Action bar (reusable UI)

- A new action bar component in the web app's shared UI layer replaces HeroUI Pro's ActionBar, which Norish cannot use since Pro was removed to keep the build AGPL-clean. It follows the shape of the Pro component: a root with `isOpen` that animates enter and exit, and optional Prefix (count), Content (actions) and Suffix (clear) sections separated by HeroUI separators.
- It is built on the toolbar from HeroUI/react-aria (focus management and arrow-key navigation come with it) and Motion, honouring reduced motion. It renders fixed at the bottom centre, on the safe-area inset the mobile nav already uses, with pointer events only on the pill.
- Labels inside it carry a convention that hides them visually below the small breakpoint, while keeping them available to screen readers.
- Buttons follow the app's button conventions: leading icon on every button, one-word labels where they fit.
- While it is open, it takes the place of the mobile nav and of the desktop floating Library pill. They hide and the bar takes their position.

### Selection

- Selection state is one shared hook/context owned by the page that hosts the grid: the Library and the cookbook page. It is a set of recipe ids plus the anchor for Shift ranges and the derived "is selecting". The grid and its cards read it; the action bar is given the selection and its actions by the page.
- The selection holds ids, not cards, so it survives search, filter, sort and view changes, and the virtualized grid can unmount cards freely. Ids that leave the reader's data (a deleted Realtime Event, or the result of the reader's own action) are pruned. When the set empties, selection ends.
- Entry points: a long-press on a recipe card (react-aria's long-press, which covers touch and mouse; the iOS callout and image drag are suppressed on the card), a **Select** item added to the card's existing swipe/ellipsis action row, and Cmd/Ctrl-click. Shift-click selects from the anchor to the clicked card in the grid's current order, among loaded cards.
- While selecting, a card's press toggles membership instead of navigating, and its swipe row, double-tap container and heart are inert. Cookbook cards and pending (importing) cards are dimmed and inert.
- Exit: the bar's clear button, Escape, the set becoming empty, or leaving the page (the hook lives in the page, so unmounting clears it).
- There is no select-all.

### Actions

- **Add to cookbook** opens a panel modelled on the existing MiniCookbooks panel: every cookbook the reader may edit, multi-pick, plus a row that names a new cookbook. On save it creates the new cookbook with the selected recipe ids, and adds the selection to each picked existing cookbook through the bulk membership add. Success clears the selection and shows a toast with an **Open** action for the cookbook (the single new or picked one; with several, Open goes to the first).
- **Delete** is offered when at least one selected recipe passes the client's delete-permission check. The confirmation is the existing delete-recipe modal, generalised to a count: it says how many recipes it will delete and how many will stay. Confirm sends only the permitted ids, plays the existing delete animation on visible cards, and clears the selection without a toast. The two near-duplicate delete modals fold into one.
- **Remove from cookbook** (cookbook page only) removes the selection from that cookbook through the bulk membership remove and clears the selection.

### Server contracts

- `recipes.delete` takes a list of `{ id, version }` and replaces the single-recipe form. Single-recipe callers (the card, the recipe page) pass one item. It is not part of the public OpenAPI surface, so there is no compatibility shim. It handles each recipe on its own:
  - access is checked per recipe under the existing permission policy; denied ones are skipped;
  - a recipe whose version no longer matches is kept (stale);
  - a recipe that no longer exists counts as deleted.
  It awaits the database work and returns the deleted and kept ids, so Replay sees a real outcome. Image directories are removed after commit, and only for recipes actually deleted. That fixes today's order, where images are deleted before the version check, so a stale delete wipes a surviving recipe's images. It publishes one Realtime Event for the deleted ids, and one telling the caller which recipes were kept as stale. The client turns that into the "changed by someone else and kept" toast and refetches.
- The repository gains a bulk delete that checks each recipe's version and reports deleted versus stale, the shape the grocery bulk delete already has.
- `cookbooks.create` takes `recipeIds` (a list, possibly empty) in place of the single optional `recipeId`. Existing callers (MiniCookbooks' "new cookbook from this recipe", the empty create) pass one id or none. Ids that no longer exist or are not visible to the creator are skipped, and the cookbook is still created.
- Cookbook membership gains a bulk add and a bulk remove that each take one cookbook and many recipe ids, under the same rule as the single membership change: view on each recipe, edit on the cookbook. The add stays idempotent for recipes already in the cookbook. One Realtime Event per call carries all the changed ids. The cookbook's add-recipes panel and its edit panel's bulk remove switch from per-recipe loops to these.
- Offline needs no Outbox changes. Admission is universal, so each bulk call is one entry, and the per-recipe handling above makes Replay of a partially stale batch a success rather than a parked conflict. The client mutations follow the existing optimistic patterns: remove from lists, adjust membership counts, keep the tentative state when Queued.

## Testing Decisions

- Tests exercise behaviour a user or caller can observe: what is selected, what the bar offers, what gets deleted or filed, what the server returns and publishes. They do not assert hook internals, component structure or call counts.
- **Browser E2E (main seam).** Playwright, in the `ai` project next to the existing cookbooks and reorder-and-swipe specs:
  - entering by long-press, by the Select row action, by Cmd-click, and with a Shift range;
  - exiting by clear, Escape and deselecting the last card;
  - the selection surviving a search change, with the count including hidden recipes;
  - Add to cookbook with a new title, then the toast's Open landing on that cookbook with the recipes in it;
  - Delete with the confirmation count, including a selection with a recipe the reader may not delete;
  - Remove from cookbook on the cookbook page;
  - the bar replacing the mobile nav at phone width.
  One case in the `offline` project: delete three recipes offline, edit one of them from a second session, reconnect; two are gone, one is kept, and the toast shows. These are committed tests, not throwaway checks.
- **tRPC procedure tests**, following the existing cookbooks, membership and groceries router tests with mocked repositories:
  - `recipes.delete` with many items covers per-recipe permission, stale kept, missing counted as done, the returned ids and the published events;
  - images are removed only for deleted recipes. This is written as a failing test against the current single delete before the fix;
  - `cookbooks.create` with `recipeIds` skips missing and invisible recipes;
  - bulk membership add and remove cover permissions, idempotency and the single event.
- **Repository test** in the existing recipes repository suite: the bulk delete checks each recipe's version against the real database and reports deleted versus stale.

## Out of Scope

- Select all, by loaded cards or by the current search/filter.
- Selecting cookbooks, or mixed recipe-and-cookbook selections.
- Other bulk actions: plan on the calendar, add to groceries, favourite, rate, export the selection as a Recipe Archive, AI enrichment. The bar takes them later without redesign.
- Selection on other lists (groceries, meal plan, admin tables), and on the recipe page.
- Undo for delete; deletion stays a hard delete behind a confirmation.
- Any change to the Outbox, its status modal, or the permission policy.
- The mobile app, which is parked.

## Further Notes

- Comes out of a grilling session on 2026-10-31. No glossary or ADR changes: selecting is a UI mechanism rather than a domain concept, and nothing here is expensive to reverse.
- The stale-delete image fix is its own commit in the same PR, its failing test first.
- Feature docs: an apps/docs page section with screenshots (selecting, the bar, Add to cookbook) and a line in the Target Version's release notes (0.26.1-beta).
