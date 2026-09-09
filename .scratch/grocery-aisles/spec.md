# Grocery Aisles

Status: ready-for-human

## Problem Statement

A Store in Norish is one flat list. The household's groceries sit under it in the order they were added or dragged, and a shopper in a large supermarket reads "melk" at the top, "bananen" halfway down and "yoghurt" at the bottom, then walks the dairy aisle twice. Every list app the household has left behind grouped a list by where things are found in the shop; Norish, which already knows which Store a name belongs to and which Store Product it is there, does not know where in the shop it is.

Sorting the list by hand does not stick. A Grocery is transient by design: it is ticked off and cleared every week, so the order a shopper dragged into place on Monday is gone by Saturday, and next week's "melk" lands wherever it lands. What the household needs remembered is not the position of a line but a fact about a name at a shop: at this Store, milk is in the dairy aisle. That is the same shape as the two memories Norish already keeps, and it is the one thing about a shop it has never been told.

## Solution

A Store gains **Aisles**: headings the household names and orders the way they walk the shop, edited where the Store itself is edited and shared with the household through the Store as everything about a Store is. A Store with no Aisles looks and behaves exactly as it does today.

Under a Store that has Aisles, the list is shown by Aisle in the Store's order. Filing a grocery, by dragging its row into an Aisle or by choosing one in the grocery's own panel, teaches the Store where that *name* is found: an **Aisle Link**, kept per Store and per normalized name the way a Product Link is (ADR-0031). Every grocery of that name at that Store sits in that Aisle from then on, on every household member's screen, this week and every week after. A name the Store has never been told about is unfiled and sits at the top of the Store's block under no heading, where it is noticed and filed; Norish never guesses an Aisle from words.

## User Stories

1. As a shopper, I want to give a Store the aisles of the shop it stands for, so that my list is shown in the order I walk the shop.
2. As a shopper, I want to order a Store's aisles myself, so that the list follows my route and not an alphabet.
3. As a shopper, I want to rename an aisle, so that a typo or a shop refit costs one edit and nothing filed under it is lost.
4. As a shopper, I want to remove an aisle, so that a heading I no longer walk disappears and what was under it is simply unfiled.
5. As a shopper, I want aisles edited in the same panel as the Store's name, colour and link, so that there is one place a Store is set up.
6. As a shopper, I want aisle edits written when I press Save and not before, so that experimenting in the editor changes nothing my household sees.
7. As a shopper, I want to be stopped from adding an aisle whose name the Store already has, so that "Zuivel" and "zuivel" cannot both exist.
8. As a shopper, I want to file a grocery by dragging its row into an aisle, so that filing six things after a shop costs six drags.
9. As a shopper, I want to file a grocery from its own panel, so that filing one deliberately is a choice from the Store's aisles and nothing more.
10. As a shopper, I want filing one "melk" to file every "melk" at that Store, so that a name is filed once and not once per line.
11. As a shopper, I want the Store to remember where a name is found, so that next week's "melk" is already in Zuivel without anybody touching it.
12. As a shopper, I want a name the Store has never seen to be unfiled rather than guessed, so that I am never shown milk in the bread aisle because a word looked like bread.
13. As a shopper, I want unfiled groceries shown first, under no heading, so that what still needs filing is the first thing I see.
14. As a shopper, I want every aisle of a Store shown even when nothing is in it, so that there is always a place to drag a row and the shop's shape is always visible.
15. As a shopper, I want an empty aisle heading to be quieter than a filled one, so that the list still reads as a list.
16. As a shopper, I want to unfile a grocery by dragging it back to the top of the Store, so that a wrong filing is undone the way it was done.
17. As a shopper, I want to unfile a grocery from its panel with "No aisle", so that the deliberate path has an undo too.
18. As a shopper, I want dragging a row into another Store's aisle to move it to that Store and file it there in one gesture, so that a grocery I put under the wrong shop is fixed in one drag.
19. As a shopper, I want a grocery moved to another Store to appear wherever that Store files its name, so that each shop's own memory applies and nothing is carried between shops.
20. As a shopper, I want a renamed grocery to be filed by what the Store remembers of its new name, so that the old answer never travels to a name it was never about.
21. As a shopper, I want ticked groceries to sink into the Store's done tail as they do today, so that aisles change nothing about how a finished line behaves.
22. As a shopper, I want the Store's heading, total, "mark all done" and "delete done" to stay exactly as they are, so that aisles add to the Store and take nothing from it.
23. As a shopper using the grouped list, I want groups kept per aisle, so that "kip" in Vlees and "kip (diepvries)" in Diepvries are two groups and not one.
24. As a shopper using the grouped list, I want dragging a group into an aisle to file every name in it, so that a group behaves as the one thing it looks like.
25. As a shopper, I want the Aisle field in the grocery panel only when the chosen Store has aisles, so that a Store without them shows me exactly the panel I know.
26. As a shopper, I want the Aisle field to show what the Store remembers for the name I have typed, so that filing reads as correcting a fact rather than filling a blank.
27. As a shopper, I want the Aisle field to switch to the other Store's aisles when I swap the Store in the panel, so that I am never offered an aisle of a shop the grocery is not in.
28. As a shopper adding a grocery, I want to file it in the same panel that adds it, so that a new name can be taught to the Store the moment it is typed.
29. As a household member, I want an aisle a housemate adds, renames or reorders to appear on my screen at once, so that we are looking at one shop.
30. As a household member, I want a filing a housemate makes to move the row on my screen at once, so that we never disagree about where milk is.
31. As a household member, I want to file and edit aisles on any Store of the household, not only my own, so that setting up the shop is not one person's job.
32. As a shopper on a poor connection, I want filing and aisle edits to work offline and catch up later, so that a list I sort in the shop's basement is sorted when I surface.
33. As a shopper with a Store that has no website, I want aisles to work exactly as they do for a priced Store, so that a market stall can have a route through it too.
34. As a shopper, I want a Store deleted to take its aisles and its memory with it, so that nothing is left behind pointing at a shop that is gone.
35. As an API user, I want a Store's aisles listed with the Store, so that a client of my own can show the same shape without a second call.
36. As a mobile user, I want my list to keep working unchanged, so that a web-only step never breaks the phone.
37. As a self-hosting operator, I want aisles to involve no AI provider and no outbound request, so that grouping a list is free and private.

## Implementation Decisions

**Vocabulary and the decision on record.** The words are **Aisle** and **Aisle Link**, defined in CONTEXT.md under Groceries & Stores; a Grocery is *assigned* to a Store, *linked* to a Store Product, and *filed* in an Aisle. ADR-0031 records the derived shape: an Aisle Link is a fact about a name at a Store, a grocery's aisle is derived from it, and nothing is stored on the grocery row. Every decision below follows from that ADR; none contradicts ADR-0028, 0029 or 0030, which are untouched.

**Two tables, one migration.** An `aisles` table holds a Store's Aisles: id, store, name, sort order, and the usual timestamps and version column; the store deleting cascades. An aisle name is unique per Store case-insensitively, checked at the procedure the way a duplicate Store name is refused today, and backed by a unique index. An `aisle links` table holds the Aisle Links: store, normalized name, aisle. It is keyed uniquely on store and normalized name, last writer wins with no version guard, exactly as the Product Link table is; deleting an aisle cascades and so *is* unfiling, and deleting a store cascades too. No backfill: nothing exists yet to migrate.

**The normalized name is the Product Link's.** An Aisle Link's key is the one folding used everywhere a grocery is matched against a shop: case, diacritics, punctuation and whitespace, nothing else. The grouped view's own folding, which strips parentheticals, stays as it is. The two therefore disagree on purpose: "kip" and "kip (diepvries)" are one grouping name and two Aisle Links.

**Aisles travel with the Store.** The Store DTO gains an ordered `aisles` list, and the Store create and update inputs carry the full ordered list. Saving reconciles: an aisle with a known id is renamed and repositioned, an aisle with a new client-minted id is created (ADR-0003), an aisle absent from the list is deleted and its links go with it, and the position in the list is the sort order. Every Store event already emitted (created, updated, reordered) carries the Store with its aisles, and the client merges by store id as it does now. The public REST `GET /api/v1/stores` therefore shows aisles read-only; `POST /api/v1/stores` is unchanged and creates a Store with no aisles.

**Aisle Links have one query and one mutation.** A query returns every Aisle Link of the household's Stores in one round trip, mirroring the query that prices the whole list; the set is small, one row per distinct name ever filed per Store. A mutation *files a name*: it takes a Store, a name as typed and an Aisle or null, folds the name server-side, refuses an Aisle that is not the Store's, requires household access to the Store, and upserts or deletes the row. Null forgets. It emits one Store subscription event carrying store, normalized name and aisle-or-null, and every client merges it by store and normalized name, a null removing the entry, so the actor's own echo and any replay are no-ops. Filing has no REST endpoint.

**Derivation happens on the client.** A shared hook beside the prices hook answers "which Aisle does this Store file this name under" from the links query plus subscription merges, and is the only place the answer comes from: the grocery DTO does not carry an aisle, the server never computes one onto a row, and mobile, which ignores the new hook and the new Store field, is untouched. This is what makes ADR-0031 true rather than a schema nicety.

**The list under a Store.** Inside each Store block, in both the flat and the grouped view: first the unfiled rows, under no heading; then every Aisle of the Store in the Store's order, each a slim heading with the aisle's name and nothing else, rendered whether or not anything is filed under it, an empty one quieter than a filled one; then the Store's one done tail, unchanged. The Store heading, its total, its menu and its actions do not change. A Store with no Aisles renders exactly what it renders today. The recipe view is untouched; aisles belong to the store view.

**Grouping is per Aisle per Store.** The grouping function takes a resolver from grocery to aisle and includes the aisle in the group key, so groups never straddle aisles. Everything else about a group, its amounts, its sources, its Line Cost, stays as it is.

**Drag and drop.** The container model gains a level: a droppable per Aisle inside each Store block, and the unfiled area as the Store's own container. Dropping a row into an Aisle of its own Store files the name and reorders; dropping it into the unfiled area of its own Store forgets the name and reorders; dropping it into another Store, into its unfiled area or any of its Aisles, assigns the Store through the existing reorder mutation and then files, in that order, so the grocery sits under the Store before its name is taught to it. Filing and reordering are separate mutations, each idempotent, each going through the same optimistic and outbox path every grocery mutation uses. Dragging a group files every distinct name in the group. Sort order stays a per-Store number; within an Aisle rows follow it. The store-level drop target the E2E already addresses keeps its attribute; aisle drop targets get one of their own.

**The grocery panel.** Both the add and the edit panel gain an **Aisle** field directly under the Store selector, present only when the chosen Store has aisles and the name is non-empty. Its options are the Store's Aisles in order plus "No aisle". It is pre-filled from what the Store remembers for the settled name, re-reads when the Store is swapped, and writes nothing until the panel's own Save, at which point filing runs after the grocery is created or updated and only when the choice differs from what the Store remembered. No hint appears for a Store without aisles; the store editor is where aisles are met, and docs and release notes introduce them.

**The Store editor.** Under the icon picker, an aisle list: a field to add an aisle by name with Enter or a plus, inline rename, drag reorder, and an X to remove. A duplicate name is refused inline. Nothing is written until the editor's footer Save, which saves the aisles with the Store in one update, so removing an aisle needs no confirmation and a new Store can be created with its aisles in one go. Aisle names are one to a hundred characters.

**Realtime and offline.** No echo suppression, as everywhere in the app: every handler merges by identity. The links query joins the persisted query cache so an offline list still groups by aisle, filings queue in the outbox and replay with first-writer-wins (ADR-0004), which is the right answer for a memory whose rule is last writer wins.

**Copy and locales.** New strings in every one of the fourteen locales: the field label, "No aisle", the editor's list and its refusals, and any heading text. The word is Aisle throughout; Category, Department and Section are not used.

**Docs and release notes.** A new Aisles page under Groceries in the docs, with screenshots shot off the running dev server the way the prices page's were, and a feature section on the current release-notes checkpoint page, which is `0.23.0-beta` at the time of writing; if the checkpoint has moved when this ships, the new checkpoint's page is where it goes. ADR-0031 is already written and indexed as Accepted.

## Testing Decisions

A good test here asserts what a shopper or a household sees or is refused, never how the aisle was derived or which hook computed it. Four existing seams, no new one.

**Browser E2E through the real stack** is the primary seam: a new aisles spec in the `ai` Playwright project beside the grocery prices spec, against a plain Store with no shop, so nothing outbound is involved. It adds two aisles in the store editor and sees every heading appear with the list unchanged above them; files a row by dragging it into an aisle and watches a same-named row follow; unfiles by dragging back to the top; files through the panel's Aisle field; renames and removes an aisle and sees rows unfile; and, in the grouped view, sees "kip" and "kip (diepvries)" become two groups once filed apart. The drag helper and the row locator already in the prices spec are the prior art.

**Repository tests against Postgres**, beside the store products repository test, pin the persistence rules: one aisle list per store in order; names unique per store case-insensitively; one Aisle Link per store and name with last writer winning; removing an aisle forgets its links; deleting a store takes aisles and links; the household's links read in one query.

**tRPC procedure tests with mocked repositories**, beside the stores procedure tests, pin access and events: filing under another household's store is refused; an aisle that is not the store's is refused; a store saved with aisles emits the store with its aisles; filing and unfiling emit a link event whose repeat is a no-op to merge.

**Component tests**, in the existing store manager and grocery panel test files, pin the panel rules: the Aisle field appears only when the chosen store has aisles and the name is non-empty; it swaps its options with the store; it writes nothing until Save; the editor refuses a duplicate aisle name and saves aisles with the store.

The grouping change has no pure-function test of its own; the visible split is the behaviour, and the E2E carries it.

## Out of Scope

- Mobile: nothing on the phone changes; it ignores the new Store field and the new hook.
- A starter set of aisles; every household types its own.
- Guessing an aisle from words, from a shop's own taxonomy or breadcrumbs, or from an AI.
- Aisle-level totals, mark-all-done or delete-done; collapsing an aisle; a heading over the unfiled rows.
- Two lines with the identical name at one Store in different aisles (ADR-0031).
- Copying aisles between Stores, or sharing one aisle list across Stores.
- A REST endpoint for filing, or aisles on the REST create.
- The recipe view.

## Further Notes

- Vocabulary: CONTEXT.md, Groceries & Stores: Aisle, Aisle Link, and the existing Grocery, Store, Product Link. Use those words in code, tickets, copy and docs.
- ADR-0031 is the decision behind everything here; read it before touching the shape.
- After editing anything under the shared packages, the injected `@norish` copies under the web app's node_modules must be refreshed and the web build cache removed, copies first, before a build or an E2E run; a stale copy shows up as an E2E red that looks like a realtime bug and is not.
- The E2E must never visit a real shop; a plain Store needs none.
- Tickets follow from this spec, one file per ticket under this directory.
