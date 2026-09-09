# Groceries page redesign

Status: ready-for-agent

## Problem Statement

The groceries page paints every Store as a coloured box. The Store's colour fills the whole header of its accordion, a generic icon sits in a solid disc beside the name, and a page with four shops reads as four pastel blocks stacked on a beige ground. The colour was meant to tell shops apart and it does, but at the cost of the page looking like a children's app rather than the calm list the rest of Norish has become since the theming refresh put white cards on a warm ground.

The icon adds nothing. A shop is identified by its name; nobody remembers which of twenty-two Heroicons they gave Albert Heijn, and the phone never showed the icon at all. The phone, meanwhile, marks a Store with a small dot in its colour and tints the row checkboxes, so web and mobile already disagree about what a Store's colour is for. They also disagree about what the colours are: the phone keeps its own colour map in which two pairs of keys resolve to the same hex, so two Stores that are distinct on the web are identical on the phone. The web's own map is mislabelled, with the key labelled "Blue" rendering as the accent green and the key labelled "Purple" rendering as neutral grey.

Around the headers, the list itself is noisier than it needs to be. In the grouped view every single manual grocery carries a "Manual Items" subtitle that doubles its row for no information. Ticked rows stay at full height under a DONE label, so the list does not get shorter as the shop gets done. An empty Store, and an always-present empty Unsorted section, each render a whole card to say there is nothing in them. The heading count reads "5 (1 done)" when the shopper only wants to know what is left.

None of the behaviour is wrong. Ticking, the reorder delay, drag and drop across Stores and Aisles, the grouped view, the By Recipe view, the totals and the panels all work and stay exactly as they are. The page needs to look like the product it belongs to.

## Solution

Every Store, and Unsorted, becomes a heading on the page ground with its rows in a white card beneath it, the shape the rest of the app already uses. The heading is a small dot in the Store's colour, the name, what is left and what it costs, the chevron, and the kebab that already holds Mark all done and Delete done. The colour appears only where it marks: the dot in the heading and the ring and fill of every checkbox under it, so the shopper still knows which shop's rows they are in once the heading has scrolled off. The icon is gone from the page, the panels, the editor and the data.

A collapsed Store is its heading line alone, and so is an empty one; a Store where everything is ticked swaps its dot for a check mark and says All done. Aisle headings get slimmer and carry a count. Ticked rows fold into one "3 done" row at the bottom of the card that opens on tap. A row with nothing to add is one line tall. The drag handle stays where it is and does what it does, quieter.

The eight stored colour keys stay, and each now maps to a clearly distinct hue in one table that both web and mobile read, so the two surfaces show the same red beside "Dirk" and the phone's collisions are gone. The By Recipe view, the grouped view, the store manager, the Store selector in the Add and Edit panels, the loading skeleton, the docs and the release notes all follow.

## User Stories

1. As a shopper, I want each Store to be a plain heading over a white card, so that the list reads as one calm page rather than a stack of coloured boxes.
2. As a shopper, I want a small dot in the Store's colour beside its name, so that I can tell my shops apart at a glance without the colour taking over the page.
3. As a shopper, I want the Store's name to be what identifies it rather than a generic icon, so that I never have to remember which glyph I gave which shop.
4. As a shopper, I want the heading to tell me how many items are left and what they will cost, so that the two numbers I care about mid-shop are on one line.
5. As a shopper, I want the heading to keep collapsing the Store when tapped, so that a long list with five shops folds to five lines.
6. As a shopper, I want Mark all done and Delete done to stay in the heading's menu, so that nothing I already know how to do moves.
7. As a shopper, I want an empty Store, and an empty Unsorted, to be a heading alone rather than a card announcing that it is empty, so that an unused shop costs one line.
8. As a shopper, I want to drop a row on a Store's heading whether or not its card is showing, so that a collapsed or empty shop is still somewhere I can move things to.
9. As a shopper, I want nothing on the page to jump when I pick up a row, so that my finger stays over the thing I am dragging.
10. As a shopper, I want to see which Store or Aisle will receive a row while I drag it, so that I let go with confidence.
11. As a shopper, I want a Store where everything is ticked to show a check mark in place of its dot and say All done, so that I can see I am finished with a shop from across the page.
12. As a shopper, I want Aisle headings to be slimmer and to say how many lines are under them, so that I can see how much of the dairy aisle is still ahead of me.
13. As a shopper, I want an empty Aisle to stay visible but quieter and uncounted, so that the shop's shape is still there to drag into.
14. As a shopper, I want ticked rows to fold into one "3 done" row at the bottom of the Store, so that what is left to buy is all I see as I go.
15. As a shopper, I want to open the done row and untick something in it, so that a mistaken tick is one tap from undone.
16. As a shopper, I want the done row's count to change as I tick and untick, so that it always says what is in it.
17. As a shopper, I want the done row to start closed every time I open the list, so that a list I finished last night is short this morning.
18. As a shopper, I want the checkbox rings in the Store's colour, so that when the heading has scrolled away I still know which shop's rows I am in.
19. As a shopper, I want a ticked checkbox filled in the Store's colour, so that a done row belongs visibly to its shop.
20. As a shopper, I want the amount in front of the name to stay in the accent colour, so that the quantity is the first thing I read.
21. As a shopper, I want a row with nothing more to say to be one line tall, so that a list of plain groceries is as dense as a list should be.
22. As a shopper, I want the recipe a grocery came from, its recurrence, or its Store Product shown beneath the name only when there is one, so that a second line always means something.
23. As a shopper, I want the drag handle to stay where it is but recede, so that dragging works exactly as it does today without every row asking to be dragged.
24. As a shopper reading at night, I want the dots and rings to stay visible on the dark ground, so that the colour works in both themes.
25. As a shopper using the grouped view, I want the same headings, dot, counts, done row and tinted checkboxes, so that switching the grouping does not switch the design.
26. As a shopper using the By Recipe view, I want recipe sections to be headings over cards in the same shape, so that the two views are one page.
27. As a shopper using the By Recipe view, I want each row's checkbox in the colour of the Store it is assigned to, so that the view tells me which shop a recipe's groceries go to.
28. As a shopper, I want the loading skeleton to have the new shape, so that nothing shifts when the list arrives.
29. As a shopper, I want my view mode and grouping choice remembered exactly as today, so that the redesign changes nothing I set.
30. As a household member, I want to pick a Store's colour from eight clearly different hues, so that no two shops end up alike.
31. As a household member, I want the colour picker to name colours by what they look like, so that a screen reader says "Rose" and not "secondary".
32. As a household member, I want the icon picker gone from the store editor, so that setting up a Store is its name, its shop link, its colour and its Aisles.
33. As a household member, I want the store manager list and the Store selector in the Add and Edit panels to show the same dot, so that one mark identifies a Store everywhere.
34. As a household member with Stores already set up, I want every Store to keep its colour through the update, so that nothing I chose is lost.
35. As a mobile user, I want the phone to draw the same hue for a Store as the web, so that the dot beside "Dirk" is the same red on both.
36. As a mobile user, I want two Stores that were indistinguishable on the phone to be distinct after the update, so that the colour does its job there too.
37. As a mobile user, I want the phone's list to otherwise stay as it is, so that a web redesign does not reshuffle my phone.
38. As an API user, I want a Store created through the REST API to need no icon, and one that still sends an icon to be accepted, so that nothing I already built breaks.
39. As a docs reader, I want the screenshots and the prose to show the page as it is now, so that the docs and the app agree.
40. As a maintainer, I want a Store's colours defined once for web and mobile, so that the two cannot drift apart again.
41. As a maintainer, I want the icon column gone rather than orphaned, so that it cannot be picked back up by accident.

## Implementation Decisions

**Vocabulary.** The words are CONTEXT.md's: Grocery, Store, Unsorted (a new glossary entry: the groceries assigned to no Store, distinct from an unfiled grocery, which has a Store but no Aisle), Aisle, Store Product, Line Cost. Within this spec a Store's block is its **heading** and its **card**, and the folded tail of ticked rows is the **done row**. Category, Section, Icon and Badge are not used.

**The section shape.** Each Store, and Unsorted, is a heading directly on the page ground followed by a card holding its rows. The sortable container that drag and drop addresses wraps heading and card together, so a drop anywhere on the heading keeps working and the heading keeps the drop-target attribute the E2E already uses. A collapsed section is its heading alone. An empty section is its heading alone: no card, no "no items" sentence. Nothing is added or removed from the page when a drag starts. Drop feedback: the card takes the accent ring it takes today; a heading whose card is absent takes a soft accent fill while it is the target. Collapse state is not persisted, as today. Headings do not stick while scrolling: dnd-kit measures drop rectangles once per drag and a sticky heading would drift away from its measured place during auto-scroll.

**The heading.** From left to right: a 10px dot in the Store's colour; the name; the meta in muted text; the chevron; the kebab. The meta reads the remaining count and the Store's total separated by a middle dot, "4 items · €17.86", using the existing "{count} items" string and the existing Store total (the sum of the Line Costs still to buy). With no total it is the count alone. With nothing remaining and something done it reads "All done" and the dot becomes a filled circle in the Store's colour with a white check mark. Unsorted has no dot, and its name and meta are otherwise the same. The kebab keeps Mark all done and Delete done and gains nothing.

**Aisle headings.** Uppercase, one size smaller than today, medium weight, muted. A filled Aisle's name is followed by the number of lines under it in the same muted style; an empty Aisle is fainter and carries no count. In the grouped view the number is of groups, since that is what is listed. Dividers and drop targets are unchanged.

**The done row.** One per section, at the bottom of the card, in the flat view, the grouped view and the By Recipe view. It reads "3 done" with its own chevron, using the existing "{count} done" string, and replaces the DONE heading. Closed on every load. Open, it shows the done rows exactly as they render today: struck through, checkbox filled. Ticking a row moves it into the tail after the existing reorder delay and the count follows; unticking a row in the open tail returns it to its Aisle. A section with nothing done has no done row. The row keeps the done heading's existing test hook and adds a state attribute for open and closed, so the E2E can find and drive it.

**Rows.** The checkbox ring takes the Store's colour at rest and fills with it when ticked, the check mark white; the indeterminate state of a group does the same. Rows under Unsorted keep the accent as today. In the By Recipe view a row's checkbox takes the colour of the Store it is assigned to, which becomes that view's only Store hint. The amount before the name stays in the accent. A second line appears only when there is something to say: the recipe name when the grocery came from a recipe, the recurrence pill when it recurs, the Store Product beneath the price as today. The "Manual Items" subtitle disappears from single manual rows in the grouped view; the string stays in use inside a mixed group's breakdown line. The drag handle keeps its position, its hit area and its dnd-kit attributes, since the E2E drag helper finds it by those; only its glyph shrinks and fades.

**Colour.** One hue table in the shared package, keyed by the eight existing colour keys, each entry holding a human name and a hex for light and for dark. The mapping is: primary the brand green, secondary rose, success teal, warning amber, danger red, slate grey, sky blue, violet violet. No entry is bound to a theme token; a Store's colour is identity and independent of the accent, so the brand green is a fixed hex that matches the accent by eye and never follows it. The web applies the colour through one CSS custom property set on each section, read by the dot, the checkboxes, the picker swatches and the selector dots, with the dark hex under the existing dark variant. Mobile deletes its own tint map and reads the table; its Unsorted section takes the grey hue, since its current purple collides with a Store colour. The picker shows the eight swatches in table order, labelled with the colour's name, and those eight names are new strings in every one of the fourteen locales.

**The icon.** Removed from the section heading in both views, from the Store selector, from the store manager rows and from the store editor, with the picker's label string. The column is dropped in one migration, and with it the field on the create and update inputs, the server-side create default and the client's optimistic default. A create that still sends an icon, over REST or from an older client, is accepted and the field ignored. Mobile never read it. Test fixtures that build a Store stop naming it.

**The other surfaces.** By Recipe sections take the same heading shape with no dot and no disc, a meta of the remaining count, and a done row. The grouped view's sections are the flat view's in every respect above. The store manager rows show the dot before the name; the Store selector shows the dot before each Store and nothing before the no-store option. The skeleton follows the new shape: a heading line and a card of row placeholders.

**Copy.** New strings: "All done" and the eight colour names. Strings no longer used, removed from every locale: the icon picker's label, the DONE heading, and "No items in this store". All fourteen locales are updated in the same commit as the code that uses them.

**Docs and release notes.** The Aisles page and the current release-notes checkpoint both say the Aisles sit "under the icon picker"; both now say under the colour. The seven groceries screenshots that show a tinted header, an icon disc or the icon picker are re-shot with the two existing docs-screenshot specs, one for Aisles and one for prices, run as separate Playwright invocations because they share a database. The dashboard screenshots are checked and re-shot only if the groceries list is visible in them. A paragraph on the current release-notes checkpoint page, `0.23.0-beta` at the time of writing, describes the new page.

**Commits.** Four, in one PR, in this order: the shared hue table with the web remap and the mobile fix; the icon drop with its migration; the page restyle across both views, the manager, the selector, the skeleton and the strings; the docs, screenshots and release notes.

## Testing Decisions

A good test here asserts what a shopper sees or can do, never which class a dot carries or which hook chose a hue. Four existing seams, no new one.

**Browser E2E through the real stack** is the primary seam for the page: the Aisles spec and the prices spec in the `ai` Playwright project already walk this list against a plain Store with no shop. They are extended, not duplicated: a Store heading shows the remaining count and total and no icon; an empty Store is a heading with no card and still receives a dropped row; ticking a row folds it into a "1 done" row, opening the row shows it struck through, unticking returns it to its Aisle; a fully ticked Store reads All done; a filled Aisle heading shows its count and an empty one none; in the grouped view a single manual row has no subtitle. The existing done-heading assertions are rewritten against the done row and its open state. The drag helper is untouched. The docs-screenshot specs double as a visual check in both themes.

**Component tests** in the existing store manager test file pin the editor: no icon control, eight swatches each labelled with its colour's name, the Aisles list directly under the colour picker. The test that anchors the Aisles list under the icon picker is rewritten to anchor it under the colour picker.

**A pure test in the shared package**, beside the aisle helpers' test, pins the hue table: every colour key has an entry, no two keys share a light hex, no two share a dark hex. That is the test that makes the phone's collision impossible to reintroduce.

**tRPC procedure tests** for stores are updated to the Store without an icon and gain one case: a create that sends an icon is accepted and the created Store carries none. Repository tests that insert Stores stop passing the column.

Mobile has no automated seam; it is type-checked with the shared table and looked at once by hand on the simulator.

## Out of Scope

- Any change to mobile's list shape: its cards, its appended done rows and its collapse rule stay. Only its colour map and its Unsorted tint change.
- Persisting the collapse state of a Store or the open state of a done row.
- Sticky Store or Aisle headings.
- A page-wide hide-done toggle or Store filter chips.
- Inline actions on the done row; Mark all done and Delete done stay in the kebab.
- A dish-colour dot for By Recipe sections.
- Any change to drag-and-drop sensors, collision detection, the drop plan or the reorder delay.
- The page header (title, Add Item, the settings menu) and the view and grouping preferences.
- The dashboard's mini groceries panel.
- New colour keys, or a migration that rewrites stored colour values.
- An ADR; the reasoning lives here.

## Further Notes

- The conventions followed are the ones the current list apps share: colour as a small identity mark (Todoist's project dot, Apple Reminders' tinted check circles) and never a filled header; Aisles as quiet uppercase sub-headers; completed items folded into one row that opens on tap (Google Keep, Microsoft To Do, Apple Reminders). No popular app stacks several stores on one screen the way Norish does, so the stacked heading-and-card is the closest mapping rather than a copy of any one of them.
- Vocabulary: CONTEXT.md, Groceries & Stores, including the new Unsorted entry. Use those words in code, tickets, copy and docs.
- After editing anything under the shared packages, the injected `@norish` copies under the web app's node_modules must be refreshed and the web build cache removed, copies first, before a build or an E2E run; a stale copy shows up as an E2E red that looks like a realtime bug and is not.
- The two docs-screenshot specs share a database and must never run in the same Playwright invocation.
- Mobile compiles with the React Compiler; a hook alias that is not `use`-prefixed gets memoised into a conditional hook call. Keep that in mind when the shared table is read from a hook there.
- Tickets follow from this spec, one file per ticket under this directory.
