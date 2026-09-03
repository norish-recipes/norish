# Cookbooks

Status: ready-for-agent

## Problem Statement

Norish's Library has only ever answered one question: what is this recipe? Every way of narrowing it — Tags, Cuisines, Categories, rating, cooking time, favourites — filters on some attribute the recipe carries. That works well for "show me something vegetarian under thirty minutes" and not at all for "show me the twelve things I actually cook on weeknights", because that grouping is not a property of any of those recipes. It is a decision a person made.

The result is that a Library grows and never organises. Past a few hundred recipes the dashboard is a wall sorted by date, and the only way back to a set someone assembled in their head — the Christmas baking, the recipes from a grandmother, the six dinners this family will eat without complaint — is to remember every title and search for them one at a time.

Tags come closest and are the wrong tool. A Tag is an open folksonomy: mintable by anyone, mintable by AI, deliberately overlapping the other taxonomies, and shared across every reader on the instance. Tagging twelve recipes `weeknight` publishes a claim about those recipes to everybody. It is a statement about what a recipe _is_, and what people want is a place to _put_ things.

The dashboard heading has been honest about this the whole time. It says "All recipes", because that is all the Library has ever been.

## Solution

A **Cookbook** is a titled set of recipes. It is the first thing in Norish that groups recipes by intent rather than by attribute, and it is deliberately thin: a title, a set of members, and nothing else to maintain. Its cover is drawn from its members' images, so it is never stale and there is nothing to upload.

The **Library** stops meaning "all recipes" and starts meaning everything a reader can see — recipes and cookbooks together, in one list. Three chips under the search bar choose what kind of thing is on screen (All, Recipes, Cookbooks), and the heading names the choice: _Your library_, _Your recipes_, _Your cookbooks_, animated as the chip changes. The chips are permanently visible, because a lens that renames the page should not be hidden behind focusing a search box.

Under **All**, cookbooks and recipes share one interleaved list ordered by the reader's own sort — not two bands, not cookbooks pinned on top. Both carry a title and a creation date, so every sort mode applies to both without inventing anything. Search is the one exception: a cookbook has only a title to match, and its relevance score is not comparable with a recipe's, so title matches are pinned above the ranked recipes and said to be pinned rather than pretending the numbers line up (ADR-0026).

Cookbooks obey the recipe permission policy an administrator has already set — no new setting, no second rule, and no case where a cookbook is visible under rules its recipes are not. Filing a recipe into a cookbook needs only that you can see the recipe and edit the cookbook; the recipe itself is never written (ADR-0027).

Two doors reach a cookbook. From the Library, the Add button becomes **+ Cookbook** while the Cookbooks chip is lit, creating an empty one to fill later. From a recipe, the quick actions menu opens a **MiniCookbooks** panel listing every cookbook you may edit with this recipe's membership shown as a toggle, plus a row that makes a new cookbook holding this recipe in one step. The same panel adds and removes, so there is one place to manage membership rather than one place to add and another to undo.

Every recipe page ends with a card naming the cookbooks it is in, or inviting you to file it if it is in none. That card is a **Hidden Item**: readers who do not use cookbooks turn it off once, per device, exactly as they can with Nutrition Information or the rating.

## User Stories

1. As a cook, I want to group recipes into a named set, so that my Library reflects how I actually cook rather than only what each recipe contains.
2. As a cook, I want that grouping to be mine, so that organising my Library does not publish a claim about the recipes to everyone else.
3. As a cook, I want a cookbook to need nothing but a title, so that making one is a decision rather than a form to fill in.
4. As a cook, I want a cookbook to show pictures of what is inside it, so that I can recognise it at a glance without reading.
5. As a cook, I want a cookbook with no images yet to still look deliberate, so that a new cookbook does not read as broken.
6. As a cook, I want my cookbooks and my recipes in one list, so that the dashboard stays one place rather than becoming two.
7. As a cook, I want to switch between seeing everything, only recipes, and only cookbooks, so that I can narrow the Library to what I am looking for.
8. As a cook, I want the heading to tell me which of those I am looking at, so that a filtered Library never reads as a Library that lost things.
9. As a cook, I want that heading to change with a small animation, so that the switch feels like one page changing rather than a reload.
10. As a cook, I want the chips visible without focusing the search box, so that I can always see and change what is on screen.
11. As a cook, I want my choice of chip remembered on this device, so that a Library I prefer to browse by cookbook opens that way.
12. As a cook, I want Clear filters to leave that choice alone, so that clearing a search does not throw me back to a view I did not ask for.
13. As a cook, I want cookbooks to sort beside recipes under the sort I already chose, so that "Newest first" means newest first for everything on screen.
14. As a cook, I want searching to find a cookbook by its title, so that I can jump to one without scrolling.
15. As a cook, I want a matching cookbook shown before matching recipes, so that searching a cookbook's name lands on the cookbook.
16. As a cook, I want filters that only make sense for recipes to simply show recipes, so that filtering by rating does not list cookbooks that cannot have one.
17. As a cook, I want opening a cookbook to be a real page with its own address, so that I can link to it, bookmark it, and use the back button.
18. As a cook, I want a cookbook page to use the grid or list layout I already prefer, so that it looks like the rest of the app.
19. As a cook, I want to search and filter inside a cookbook, so that a large cookbook stays usable.
20. As a recipe editor, I want to add a recipe to a cookbook from the recipe itself, so that filing happens where the decision happens.
21. As a recipe editor, I want to see which cookbooks a recipe is already in while I am adding it, so that I do not have to remember.
22. As a recipe editor, I want to remove a recipe from a cookbook in the same place I added it, so that undoing a mistake is not a hunt.
23. As a recipe editor, I want to make a new cookbook straight from a recipe, so that "these two belong together" takes one step.
24. As a recipe editor, I want to make an empty cookbook and fill it later, so that I can set up a Christmas cookbook in November.
25. As a recipe editor, I want a recipe to belong to several cookbooks, so that a dish can be both a weeknight dinner and a family favourite.
26. As a recipe editor, I want adding the same recipe twice to change nothing, so that a double tap does not produce a duplicate.
27. As a recipe editor, I want to rename a cookbook, so that a name I chose quickly can be improved.
28. As a recipe editor, I want to rename or delete a cookbook from its card in the Library, so that I do not have to open it first.
29. As a recipe editor, I want to rename or delete a cookbook from inside it, so that I do not have to leave to fix its name.
30. As a recipe editor, I want deleting a cookbook to be confirmed by name, so that I do not lose one by mis-tapping.
31. As a recipe editor, I want deleting a cookbook to leave its recipes alone, so that organising is never destructive.
32. As a recipe editor, I want a cookbook to survive losing its last recipe, so that emptying one does not silently destroy the name I chose.
33. As a reader, I want a recipe page to tell me which cookbooks it is in, so that I can see where a recipe sits in my Library.
34. As a reader, I want to jump from that card to a cookbook, so that "what else is in here?" is one tap.
35. As a reader who does not use cookbooks, I want to hide that card, so that my recipe pages stay as slim as they are today.
36. As a reader, I want hiding it to be my choice on my device, so that hiding it on my phone does not change my partner's screen.
37. As a household member, I want to edit the cookbooks my household made, so that we can build one together rather than each keeping our own.
38. As a household member, I want a cookbook a housemate changed to update on my screen, so that we are looking at the same Library.
39. As a household member, I want a cookbook made by someone who later deleted their account to stay, so that a departure does not empty a shared Library.
40. As a reader on a shared instance, I want to file someone else's recipe into my own cookbook, so that I can collect from the whole instance without needing permission to edit what I collect.
41. As a recipe owner, I want my recipe unchanged when someone files it, so that being collected is not an edit to my recipe.
42. As an Offline user, I want my cookbooks available without a connection, so that the Library is not half empty the moment I lose signal.
43. As an Offline user, I want to open a cookbook and see its members, so that browsing works the way it does when Live.
44. As an Offline user, I want a member whose detail is not cached to say so rather than fail, so that a partly cached cookbook is still usable.
45. As an Offline user, I want to make a cookbook and file recipes into it while Offline, so that organising is not something I have to postpone.
46. As an Offline user, I want that work to arrive intact when I am Live again, so that queued filing lands in the cookbook I made rather than nowhere.
47. As an administrator, I want cookbooks to obey the recipe visibility I already configured, so that I do not have a second permission model to reason about.
48. As an administrator, I want no new setting to configure, so that upgrading adds a feature rather than a decision.
49. As a self-hoster, I want cookbooks to need no new infrastructure, so that upgrading is an ordinary release.
50. As a translator, I want the three headings as three complete strings, so that my language decides its own word order.
51. As a maintainer, I want the mobile app unaffected by this release, so that shipping cookbooks on web cannot break a client no gate builds.
52. As a maintainer, I want the data model to serve mobile later without change, so that mobile cookbooks are a UI project rather than a redesign.

## Implementation Decisions

**Schema.** Two new tables: a cookbooks table carrying an id, a nullable `userId` referencing the user with `set null` on delete, a title, timestamps and the standard version column; and a membership join table referencing cookbook and recipe, both cascading on delete, unique on the pair so a set cannot hold a duplicate. Membership carries its own creation timestamp, which costs nothing and leaves "recently added" available as a future sort. No order column — a Cookbook is a set, not a sequence. No cover column, no description.

**Ownership and permissions.** Cookbooks reuse `RECIPE_PERMISSION_POLICY` for view, edit and delete rather than introducing a household-keyed entity or a new setting (ADR-0027). The view-policy condition that recipes already build is reused for cookbooks, including the clause that makes an **Orphaned** row visible to everyone under every policy. Filing requires view on the recipe and edit on the cookbook, and the mutation never writes the recipe row: no version bump, no notification, no realtime event on the recipe.

**The Library query.** One repository entry point returns a single paginated list of both kinds, unioned over a common projection (id, kind, title, creation date, plus the fields each card needs) and ordered by the active sort mode. Pagination stays limit/offset over the union, so `total` counts both kinds and nothing reading it may treat it as a recipe count. The type filter is a parameter of that query, not a client-side slice: choosing Recipes or Cookbooks narrows the union rather than filtering a page that was already fetched.

**Search.** Recipes keep their existing weighted tsvector and `ts_rank` ordering. Cookbooks match on title only. Matching cookbooks are ordered ahead of the ranked recipes rather than scored against them, because the two documents differ in shape and length and `ts_rank` normalises by length (ADR-0026). A reader who removes Title from the search fields removes cookbooks from search entirely, which is the honest reading of that control.

**Recipe-only filters.** Rating, cooking time, categories, tags and favourites have no meaning for a cookbook, so any active one restricts the union to recipes.

**Cover.** Derived at read time from the first few members' primary images, resolved gallery-first through the same rule recipes already use, and ordered so the mosaic is stable between reads. Fewer members than tiles fills what exists; none renders a plain tinted tile.

**Filter contract.** The shared recipe filter contract gains one field for the type filter, defaulting to All, persisted alongside the existing fields and included in the query serialisation. It is deliberately excluded from the "has applied filters" predicate and from the funnel's active dot, because the heading already announces it and Clear filters must not reset it. The normaliser must treat an absent or unrecognised value as All so that filters persisted by the mobile app — which shares this contract and will not render the field — round-trip without corruption.

**Search fields relocate.** The five search-field toggles move out from under the search bar into the Filters panel as a "Search in" group, applying behind the panel's existing Apply button. `SEARCH_FIELDS` and the persisted field stay exactly as they are; only where they are rendered changes.

**Library surfaces.** The chips render permanently under the search bar, and the two-second blur timer that hid the old toggles is removed with them. The heading is three complete translated strings crossfaded with a short vertical slide and an animating width, collapsing to an instant swap under reduced motion. The cookbook card matches the recipe card's height in both grid and list so the window virtualizer's row estimates stay accurate on mixed pages. The Add button becomes chip-aware: **+ Cookbook** under Cookbooks, unchanged under All and Recipes.

**Cookbook page.** A route per cookbook rendering its members through the existing grid, honouring the stored view mode, the Filters panel, search and scroll restoration. Its heading carries the same rename and delete menu the card carries. Deleting confirms by name, following the recipe delete modal, and never touches the recipes.

**Membership panel.** A new panel beside the existing mini-calendar and mini-groceries consumers, listing cookbooks the reader may edit with membership as a toggle and a row that creates a cookbook holding the current recipe. It is the same component the recipe-page card's add affordance opens.

**Recipe page card.** A card at the end of the recipe page listing the cookbooks the recipe is in, or an invitation when it is in none. It joins the **Hidden Item** set, so it takes a per-device visibility preference and a settings switch beside the existing ones.

**Offline.** Cookbooks and their membership join the **Warm Set** guaranteed floor; member recipes keep the existing fifty-recipe guarantee, so an Offline cookbook page may list a member whose detail is not cached and must render the existing unavailable-offline treatment rather than failing. Cookbook mutations need no special admission — the **Outbox** admits any mutation — and creation mints its id on the client so that filing queued behind a create still points at the right cookbook (ADR-0003). Conflicts follow first-writer-wins (ADR-0004) with no new resolution rule.

**Realtime.** Cookbook and membership changes broadcast without echo suppression, following recipes rather than groceries: suppression exists only where the actor already holds the change locally, which is not the case here.

**Recipe Archive.** Cookbooks do not travel. The archive stays an exchange of recipe content, and adding them later is additive under the existing format version (ADR-0022).

**Mobile.** No mobile surfaces ship. The schema, repositories, router and shared contract are built to serve both clients, and the only requirement on the mobile app is that the new contract field round-trips harmlessly through its persisted filters.

## Testing Decisions

A good test here asserts what a reader can observe: what the list contains and in what order, what is stored, what is refused, and what the reader is told. It does not assert that a particular helper ran with particular arguments unless that call is itself the observable behaviour at that seam. Every seam below already exists; none is new.

**Repository against a real database.** The single most important seam, beside the existing recipe projection tests that use the same testcontainers base, because a mocked repository cannot prove that a union orders anything. It covers: both kinds interleaved correctly under all four sort modes; pagination over the union producing no gaps and no repeats across pages; the type filter narrowing the union; matching cookbook titles ordered ahead of ranked recipes; a recipe-only filter restricting results to recipes; each view policy filtering both kinds; an Orphaned cookbook visible under every policy; membership unique on its pair so a duplicate add changes nothing; deleting a recipe removing it from every cookbook and leaving those cookbooks in place; and deleting a cookbook leaving its recipes untouched.

**tRPC router with mocked repositories.** The permission contract, following the existing recipe permission integration test: filing requires view on the recipe and edit on the cookbook; a reader who can see but not edit a recipe may still file it; a reader who cannot edit the cookbook is refused; rename and delete follow the policy's edit and delete levels; and the recipe row is never written by any membership mutation.

**Shared filter contract.** Extends the existing contract test: the type filter's default is All, it serialises into the query filters, it survives a persistence round-trip, an absent or unrecognised value normalises to All rather than corrupting the payload, and it is excluded from the applied-filters predicate. The absent-value case is the one that protects the mobile app, which shares this contract and which no gate builds.

**Warm Set unit test.** Extends the existing warm-set test: cookbooks and membership are part of the guaranteed floor, and a cookbook created while Live joins it immediately rather than at the next warm.

**Browser E2E in the `ai` project**, which is the production-like browser project despite its name and already holds the smoke, first-paint and mobile-layout specs. Required because these are user-visible workflows whose acceptance depends on browser behaviour. One spec covering: the three chips switching the list and the heading; a cookbook and a recipe appearing interleaved under the reader's sort; creating a cookbook from the Library under the Cookbooks chip; filing a recipe from its quick actions and seeing it on the recipe page card; removing it again from the same panel; opening the cookbook page and finding the member; and renaming and deleting a cookbook without disturbing its recipes.

## Out of Scope

- **Mass select and bulk add.** Explicitly deferred to its own feature.
- **All mobile surfaces.** The data and contract layers serve mobile; no mobile UI ships.
- **Manual ordering of a cookbook's members.** A Cookbook is a set; drag ordering would add a column, a mutation, offline queueing for it and a reorder conflict rule.
- **Cookbook cover uploads**, and any cookbook media of its own. The cover is derived.
- **A cookbook description**, or any stored field beyond the title.
- **Nesting** — cookbooks inside cookbooks.
- **Cookbooks in a Recipe Archive**, and exporting a cookbook as its own archive.
- **Cookbook share links.** Recipe share links are unaffected and gain nothing.
- **Any AI involvement.** Cookbooks are not a kind of Recipe Enrichment; nothing suggests, names, or fills one.
- **A new administrator setting**, including any cookbook-specific permission level.
- **Searching a cookbook by its members' names.** Deferred deliberately; it is recorded with its cost in ADR-0026.
- **Hiding cookbooks from the Library entirely.** The Hidden Item added here covers the recipe-page card only.
- **Transferring ownership of a cookbook.** No such path exists for recipes either.

## Further Notes

The two decisions that will look wrong from outside are written up rather than left in this spec: ADR-0026 for the single interleaved list and the search-pinning rule, ADR-0027 for reusing the recipe permission policy and for membership being the cookbook's business. Both carry their rejected alternatives, and several of those rejected options look like obvious improvements until the reasoning is read — banding cookbooks above recipes especially. Read them before changing either behaviour.

The chip-aware Add button and the permanently visible chips are load-bearing on each other. The button was only acceptable because the chip that decides its meaning is always on screen beside a heading that names it. If the chips are ever moved back behind search focus, the Add button has to stop being chip-aware in the same change.

Two known local traps sit directly under this work. Positioned popovers rendered inside a panel need the panel's portal container wired, or they attach to a transformed ancestor and land in the wrong place — relevant to anything the membership panel opens above itself. And dropdown menus whose items derive from state their own action mutates have a documented focus-steal race; the quick actions menu already closes before running its action, and the membership panel should not reintroduce the pattern by rebuilding its list mid-exit.

Anyone building this locally should know that the injected workspace copies of shared packages go stale: after editing shared packages, the copies under the root and app `node_modules` need refreshing and the web app's build cache clearing, in that order, before a web build or an E2E run means anything. A quiet E2E failure here is far more often stale artifacts than a real regression.

Finally, `docs/adr/index.html` does not currently satisfy the repo's formatter and did not before this work. Do not reformat it as a side effect of adding links to it.
