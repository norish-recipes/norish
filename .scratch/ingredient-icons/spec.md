# Ingredient Icons

Status: ready-for-agent

## Problem Statement

A recipe's ingredient list, a grocery list and the Pantry are walls of words. A cook scanning for "the garlic" or a shopper checking the list in a store recognises a picture faster than a name, and recipe apps that show one per ingredient read noticeably calmer. Norish shows none.

A community PR (#605) added pictures, but it was built on the retired Ingredient Name model (a picture per name row, text matching for groceries), before the catalogue existed. It conflicts in fifty places, and its pictures stand on a background. A useful icon has no background, so it sits cleanly on any page tint, in light and dark. No public, redistributable set of generic food pictures exists to fill the catalogue with. The only open one, Ingredient Atlas (CC0), covers a fifth of the seed with photo-like shots whose shadows and props survive a cut-out. Everything else recipe apps use is proprietary.

## Solution

Every Ingredient can show an **Ingredient Icon**: a small, soft-3D picture of the food on a transparent background, beside its name wherever a food is named. These places are:

- recipe lines, cooking mode, step chips and the share page
- the recipe editor
- groceries and recurring groceries
- the Pantry
- the Ingredients page and panel

An icon belongs to the food, not to a spelling. It is the same for every household on the instance.

A food shows, first match wins:

1. its own icon, which a person uploaded or generated
2. the icon Norish ships for its Open Food Facts entry
3. its nearest Parent Ingredient's icon, so a red onion shows the onion
4. a muted placeholder

Headings, and lines that name no food, show nothing.

**The shipped set.** Norish ships its own set, drawn once by the maintainers in one style: about 5,600 icons covering every seeded food except a short list of vague groups (fruit, vegetable, dairy…), which are left without one so borrowing stops before it turns vague. The set is 128px WebP files committed to the repo and built into the Docker image. It is AGPL like the rest of the repo.

**On an instance.** Anyone who may edit a food can upload or generate its icon in the Ingredient panel. A generated icon is drawn by the configured image provider from the food's name and its parent chain, then cut out. A **Draw icons** round on the Ingredients page fills many foods at once. Readers who don't want icons hide them as a Hidden Item.

## User Stories

1. As a cook reading a recipe, I want a small picture beside each ingredient line, so that I find "the garlic" at a glance.
2. As a cook, I want the icon to stand on no background, so that it sits cleanly on the recipe's tinted page in light and dark.
3. As a cook in cooking mode, I want the same icons beside the ingredients, so that I recognise what to grab mid-step.
4. As a cook, I want a step's ingredient chips to show their icons, so that I see what a step uses without reading.
5. As a cook, I want "2 onions, diced" and "1 ui" to show the same onion icon, so that every spelling of a food looks the same.
6. As a cook, I want a red onion with no icon of its own to show the onion's, so that most foods have a picture even when nobody drew one.
7. As a cook, I want a kohlrabi with no icon anywhere in its lineage to show a quiet placeholder rather than a vague "vegetable" picture, so that an icon never misleads me.
8. As a cook, I want lines without an icon to keep the column aligned, so that the list doesn't look broken.
9. As a cook, I want section headings in an ingredient list to show no icon, so that they still read as headings.
10. As a shopper, I want each grocery to show its food's icon, so that I scan the list in the store faster.
11. As a shopper, I want a grocery I typed by hand to show its icon once Norish knows the food, so that typed items look like recipe items.
12. As a shopper offline in a store, I want icons I have seen before to still show, so that the list looks the same without signal.
13. As a household member, I want recurring groceries to show their icons too, so that every row on the list behaves the same.
14. As a household member, I want my Pantry to show icons, so that I see what we have at a glance.
15. As a person editing a recipe, I want an ingredient row to show its icon as soon as the name matches a known food, so that I see Norish understood what I typed.
16. As a reader of a shared recipe who is not signed in, I want the icons too, so that a shared recipe looks like it does in the app.
17. As a reader who prefers plain text, I want to hide ingredient icons on my device, so that lists stay compact on a small phone.
18. As someone browsing the Ingredients page, I want each food's icon in its row and panel, so that the catalogue is easy to scan.
19. As a person who may edit a food, I want to upload an icon in its panel, so that a food Norish drew badly or not at all gets the right picture.
20. As a person uploading, I want a product shot on a plain background to be cut out automatically, so that I don't need an image editor.
21. As a person uploading, I want a photo whose background is not one flat colour to be kept as it is, so that a cut-out never eats the food.
22. As a person who may edit a food, I want to generate its icon in the panel, so that a food I minted gets a picture in the instance's style.
23. As a person generating, I want the icon drawn from the food's name and what it is a kind of ("pepper, a kind of spice"), so that ambiguous names come out right.
24. As a person editing a food, I want the new icon to wait for Save like the rest of the panel, so that Cancel leaves the food as it was.
25. As a person editing a food, I want to remove the icon I set, so that the shipped one (or the parent's) comes back.
26. As a person who may edit nothing, I want no icon controls, so that the panel doesn't offer what I can't do.
27. As a person on an instance with no provider that can draw, I want Generate and Draw icons hidden while Upload still works, so that I'm never offered a button that fails.
28. As a person who may edit foods, I want a Draw icons round with a scope, either "Only foods with no icon at all" or "Every food without its own icon", so that I fill the gaps without redrawing what already borrows a good one.
29. As a person starting a round, I want to see how many icons it will draw, so that I know what I am about to pay for.
30. As a person running a round, I want to see its progress, and to have one food's failure skip only that food, so that a long round is trustworthy.
31. As a person running a round, I want the vague groups left out, so that the round doesn't draw "vegetable" and make every unpictured vegetable borrow it.
32. As a person who may edit no food in either scope, I want no Draw icons button, so that the page offers only what I can do.
33. As an administrator, I want the icon style to be an administrator-editable Prompt like every other request, so that my instance's own icons can be tuned.
34. As an administrator, I want icons drawn at the provider's cheapest quality, so that an icon shown at 32px doesn't cost a full illustration.
35. As a person who set an icon for a seeded food, I want a new release's icon set never to overwrite it, so that my choice sticks.
36. As a person on a new install, I want every common food to already have an icon, so that the feature works without an image provider or any setup.
37. As a person merging two Ingredients, I want the surviving food to keep its own icon, or take the other's when it has none, so that no picture is lost in a merge.
38. As a maintainer, I want a tool that draws a sample sheet of about 20 foods at low and medium quality, so that the style and tier are approved on real pictures before the full run is paid for.
39. As a maintainer, I want the full run to resume where it stopped and to skip foods already drawn, so that a failed batch doesn't cost the whole set again.
40. As a maintainer, I want the set drawn through the same AI Runtime path an instance uses, so that the shipped style and an instance's own drawings match.
41. As a self-hoster, I want the icons served by my own server and built into the image, so that readers' browsers never call a third party.

## Implementation Decisions

**Model**

- An Ingredient gains one nullable own icon, a reference to a stored file. That is the only schema change (one migration). Nothing about an icon is stored on a recipe line, a grocery or a Pantry row: they already reach their food through their alias or their Ingredient.
- A merge keeps the target's own icon and takes the source's when the target has none, beside the existing `off_id` coalesce.
- Icons don't travel in a Recipe Archive.

**Which icon a food shows** (the main seam)

- One service takes Ingredient ids and returns, per id, the icon's address or none, in the order own, then shipped for its `off_id`, then the nearest ancestor's (own or shipped).
  - The lineage walk follows the existing pattern: a recursive ancestor query returning each id's lineage, with the choice made in TypeScript (as nutrition's lineage does), and a depth cap like the others.
  - This is the third reader of the Parent Ingredient tree beside Aisles and Pantry coverage (ADR-0037, amended 2026-10-05; nutrition is ADR-0039's).
- The browser asks through one query, `ingredients.icons({ ids })`. Every surface collects the food ids it shows and reads the map.
  - The query is persisted with the rest of the query cache, so icons work offline.
  - An icon change (Save in the panel, a round's progress) invalidates it.
  - Rows the server hasn't resolved yet (`ingredientId` absent) show the placeholder.
- The share page exposes no ids by design, so its public lines carry the icon address itself, resolved on the server by the same service.
- Recurring groceries' DTO gains their `ingredientId`.
- Editor rows read their food through the existing `ingredients.find`, which never mints, then the same query.

**Files and addresses**

- **Making an icon.** A pure function takes picture bytes and returns a 128px square transparent WebP:
  - if the picture already has transparency, it is only trimmed and fitted;
  - otherwise the flat background touching the edges is removed by a flood from the border within a tolerance, so an egg's white survives;
  - if the border isn't one flat colour, the picture is kept as it is.
  
  It uses sharp (already a dependency). The existing image save path re-encodes everything to JPEG, so icons get their own WebP save path. The usual size limit and HEIC support apply.
- **Own icons** are stored under the uploads directory with content-hash filenames.
- **Shipped icons** live as data in a workspace package (the Docker image already copies package data). The set carries a manifest: `off_id` → file, plus the list of `off_id`s deliberately drawn no icon (the vague groups).
- **One route** serves both kinds at versioned, immutable addresses (ADR-0021). The service worker caches images cache-first, so a replaced icon must get a new address. The route is excluded from the auth proxy, so the share page loads it, since an icon carries no household data.
- Never-saved draft files and files a removal left behind are swept by the scheduled tasks.

**Drawing**

- The AI Runtime's image entry point gains:
  - a square shape: 1024×1024, or the provider's square aspect;
  - the cheapest quality tier where the provider has one (OpenAI-family `low`; providers without tiers are unchanged);
  - a second image Prompt, `ingredient-icon-style`, administrator-editable like every Prompt, whose default describes the soft-3D style. It has no system turn, like `image-generation-style`.
- The feature appends Prompt Sections and never passes a finished prompt (ADR-0016):
  - the food's own name, English where known;
  - its parent chain;
  - a code-owned section asking for one food centred on a flat background with no shadow or props, and for foods with no shape of their own to sit in the plainest vessel (milk in a glass, oil in a bottle, flour in a small bowl).
  
  The background section is the code's because the cut-out depends on it.
- **Generate in the Ingredient panel** runs inside the request, with no job. The result is stored as an unattached file and lands in the panel's draft. Save attaches it through `saveDraft` (an icon field: unchanged, new file, or remove own). Cancel leaves it for the sweep.
- **Upload in the panel** is processed the same way and lands in the draft.
- **Draw icons** is a background round modelled on the Ask AI round:
  - a scope dialog with counts per scope; no price, since image pricing differs by provider and model;
  - one job per round, one step per food, the worker wrapped in `instrumentProcessor` like every worker;
  - foods the asker can no longer edit are passed over, and one food's failure is recorded on its step without ending the round;
  - progress shows in the page header like a running Ask AI round;
  - it writes icons directly, with no review queue;
  - it never includes the set's "drawn none" list, and a person may still set one of those by hand.
- **Gating**
  - Upload, Generate and Remove need edit rights on the food (the existing ingredient permission policy; a seeded food is an administrator's).
  - Generate and Draw icons also need AI enabled and an Image Generation provider configured.
  - "Can draw" is exposed to the browser beside `isAIEnabled`, so the buttons hide rather than fail.
  - Draw icons is hidden when the person may edit no food in either scope.

**Presentation**

- One icon component with a fixed size scale: chips about 20px, lines and groceries 32–40px, the panel no more than 64px.
- The muted placeholder has the same size. Headings get no slot.
- In the panel, clicking the icon offers Upload, Generate and Remove (Remove only for the food's own icon), as part of the draft. There's no paste.
- A Hidden Item `ingredientIcons` hides every icon for that reader's device. The hidden-items provider is mounted on the share layout from the same cookie, as the amount display already is.

**The shipped set**

- A tooling workspace holds the drawing tool and the hand-picked list of vague groups.
- The tool reads the seeded catalogue from a configured Norish database and draws through the AI Runtime with that instance's image provider, so there's no second provider client and the AI boundary holds.
- **Sample mode** draws about 20 chosen foods at low and medium quality into a contact sheet for approval.
- **Full mode**:
  - draws every seeded food not in the vague list;
  - resumes and skips foods already present;
  - writes the 128px files and the manifest;
  - discards the 1024px originals.
- Industrial entries ("acid whey", "mono and diglycerides") are drawn too. Nobody sees them unless a recipe names one, and filtering them saves less than it costs.

## Testing Decisions

A good test states a fact a person would recognise ("a red onion with no icon shows the onion's") through a public interface. It never asserts table layout or a filename.

- **Which icon a food shows, against a real database** (testcontainers, beside the catalogue's service tests). This is the main seam. A small fixture set stands in for the shipped set. It covers:
  - own outranks shipped
  - shipped by `off_id`
  - the nearest ancestor's own or shipped icon
  - a "drawn none" group stops nothing but has none itself
  - no icon at all
  - removing an own icon brings the shipped one back
  - a merge keeping or taking the icon
- **Making an icon,** as a pure function over tiny pictures sharp draws inside the test (prior art: the dish-colour tests). It covers:
  - a flat background becomes transparent
  - an interior patch in the background colour survives
  - an uneven border is kept as it is
  - an already-transparent picture is only trimmed
  - the output is a 128px WebP
- **The AI Runtime's image entry point** (extending its existing image-generation test): a square shape per provider, the cheapest tier where one exists, the icon Prompt, and appended sections.
- **The ingredients router,** at the tRPC caller with mocked repositories (prior art: the existing ingredients router tests). It covers:
  - upload, generate and saving an icon in a draft under the everyone/household/owner matrix, with seeded foods administrator-only
  - generate refused when it can't draw
  - Draw icons scope counts excluding the vague groups and foods the person can't edit
- **The Draw icons worker,** following the ingredient-review worker tests: one step per food, a failure skips only that food, foods no longer editable are passed over.
- **One browser spec in the `ai` project,** using the fake image provider's image lane. It covers:
  - an uploaded icon shows on a recipe line and the grocery list
  - a child shows its parent's
  - Generate lands in the draft and appears only after Save
  - the Hidden Item hides icons
  - a Draw icons round fills a bare food
  
  It follows the image-generation and ingredient-catalogue specs, including their shared-database traps.
- The drawing tool is checked by its sample run, not by tests. The vague-groups list and the manifest format are exercised through the service test's fixture.

## Out of Scope

- Name suggestions while typing in the recipe editor (PR #605 built them). They are a separate feature.
- Pasting an image into the panel.
- An Ingredient Atlas, Wikimedia Commons or emoji base layer.
- A review queue for drawn icons, and price estimates for image rounds.
- Automatic drawing when a food is minted.
- Per-household icons.
- Icons in a Recipe Archive.
- The mobile app (parked).
- Showing whether an icon was drawn or uploaded.
- Keeping the 1024px originals.
- Gating the recipe page's existing Generate image item on "can draw". The new flag makes it possible, but it's not this feature.

## Further Notes

- PR #605 (techmatt101) is the inspiration, not the base: this is rebuilt from scratch on the catalogue. Its issue is #586 and its Alternative Names follow-up is #587. Closing the PR with thanks is the maintainer's to do.
- **Why our own set rather than Ingredient Atlas** (recorded here rather than in an ADR, since switching sources later is cheap):
  - Atlas covers about a fifth of the seed, so most of the catalogue would still need drawing.
  - Its photo style goes muddy at 32px.
  - A test cut-out kept its baked-in shadows as pale smudges, and some of its shots carry props (a bowl, a spoon, flowers).
- **Assumed:** the cheapest quality tier holds up at 128px. The sample sheet confirms or overturns this before the full run. Expected cost of the full run is roughly $30–35 at a low tier and $60–300 at medium, depending on the model.
- Expected size: about 2–4 KB per icon, so about 15–20 MB for the set.
- Glossary: **Ingredient Icon** (new); Parent Ingredient and Hidden Item updated. ADR-0037 amended 2026-10-05 for the new reader.
- Target the current release's notes and the docs (a page with screenshots, plus the Hidden Items and AI provider pages), per `docs/agents/feature-docs.md`. No new environment variables.
