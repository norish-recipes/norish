# Ingredient pictures

Status: implemented

> **Revised 2026-09-17:** the separate Ingredient Catalog (two tables, a stored link, SQL relinking) was folded into `ingredients`. Pictures and Alternative Names now live on the Ingredient Names themselves and are matched at read time; the admin list shows every name; a used name cannot be deleted. The issues in `issues/` were written against the catalog model and are kept as history.
>
> **Split 2026-09-18:** Alternative Names and Merge were taken out of this feature and moved to a follow-up. They are an ingredient *matching* concern, not a picture concern: a picture is a column on the Ingredient Name, while an Alternative Name changes which row a line points at and what text it shows. This spec is kept as written; the sections about other names describe the follow-up, not what ships here.

## Problem Statement

An ingredient list is a column of words. For a reader who takes in pictures faster than text, finding "the coriander" in a twenty-line list, on a phone propped against a jar, means reading every line until the word turns up. The same is true of the grocery list in a shop aisle and of the chips under a step in cooking mode. Nothing on those surfaces helps the eye land on the right line.

A small picture of the ingredient beside each line would. The obstacle is supply: there is no reliable, openly licensed set of ingredient pictures in one consistent style, and a mismatched set — a photograph here, a clip-art icon there — is harder to scan than no pictures at all. Consistency matters more than realism.

Norish can already draw pictures (ADR-0024), so it can draw these too, in one style every picture shares. What it lacks is anywhere to keep them and any way to decide which picture a line means. Every recipe line already points at a de-duplicated row of the name it was typed with, but that row is just the name as typed: "eggs", "Eggs" and "large eggs" are three rows, and nothing says they are the same ingredient.

## Solution

Pictures and **Alternative Names** on the **Ingredient Names** recipes already use. An administrator sees every Ingredient Name with how many recipes use it, and gives any of them a picture and Alternative Names. Everyone reads them.

A line shows a picture **by name**, never by hand and never by AI: its own name's picture, else that of a name folding to the same form under `normalizeGroceryName`, else that of a name carrying its folded form as an Alternative Name. That is the rule the Product Link, the Aisle Link and the Pantry already use, and the only one. Nothing stores the match, so adding an Alternative Name lights up every recipe that uses it at once, and removing one turns them off again (ADR-0037).

Pictures reach readers on the web beside recipe lines (also cooking mode and the public share page), inside step ingredient chips, beside editor rows the moment a name matches, and beside groceries matched on the device, offline too.

The recipe editor **suggests** names that have a picture or Alternative Names while a line is typed; picking one rewrites only the name part, and free text is saved as typed.

An administrator manages ingredients from a card in the admin settings: search every name, rename (which changes every recipe using the name), edit Alternative Names, delete a name no recipe uses, and give each a picture — uploaded, pasted, or drawn by the image model with its own Prompt. "Generate missing pictures" draws every used or aliased name without one, naming the count first.

A reader who would rather not see ingredient pictures hides them, per device, like every other Hidden Item.

## User Stories

1. As a visual cook, I want a small picture beside each ingredient line, so that I can find the ingredient I need without reading every line.
2. As a visual cook, I want every picture drawn in the same simple style, so that the pictures read as a set rather than as noise.
3. As a cook, I want the same pictures in cooking mode and on a step's ingredient chips, so that the help is there when my hands are full.
4. As a cook sharing a recipe, I want the pictures to show on the public share page, so that the person I shared with gets the same help.
5. As a shopper, I want the pictures on my grocery list, so that I can pick items off shelves by sight.
6. As a shopper, I want a grocery I typed by hand to get its picture too, so that pictures do not depend on where an item came from.
7. As an Offline shopper, I want grocery pictures to keep showing without a connection, so that the list still helps in a basement supermarket.
8. As a recipe editor, I want the editor to suggest ingredient names as I type a line, so that I can pick a name that has a picture.
9. As a recipe editor, I want picking a suggestion to change only the ingredient name, so that the amount and unit I typed stay as they are.
10. As a recipe editor, I want to keep typing any name, so that pictures never stand between me and my recipe.
11. As a recipe editor, I want pasting a whole ingredient list to work as it always has, so that suggestions never get in the way of a paste.
12. As a recipe editor, I want Enter to keep moving to the next line unless I chose a suggestion, so that my typing rhythm does not change.
13. As a recipe editor, I want to see a row's picture appear as soon as its name matches, so that I know the line is linked before I save.
14. As a reader, I want to hide ingredient pictures on a device where I find them distracting, so that the choice is mine per screen.
15. As an administrator, I want to add ingredients with a name and other names, so that the different ways recipes write an ingredient all show one picture.
16. As an administrator, I want to be told when a name already belongs to another ingredient, and which, so that one name never means two things.
17. As an administrator, I want adding another name to link existing recipes straight away, so that I do not have to re-save anything.
18. As an administrator, I want to upload or paste a picture for an ingredient, so that I can use one I already have.
19. As an administrator, I want the image model to draw an ingredient's picture, so that I do not have to find one.
20. As an administrator, I want to edit the prompt ingredient pictures are drawn with, so that I can tune the style for my household.
21. As an administrator, I want to draw every missing picture in one action, told the count first, so that I can weigh the cost before I spend it.
22. As an administrator, I want drawing to be unavailable rather than broken when no image provider is configured, so that I am not offered something that cannot work.
23. As an administrator, I want deleting an ingredient a recipe uses to be refused, with how many recipes use it, so that administration is never a way to damage recipes.
24. As an administrator, I want imports never to add pictures or Alternative Names, so that those stay the ones I chose.
25. As a self-hoster, I want upgrading to link existing recipes without any action from me, so that the feature works on my old library.

## Implementation Decisions

**Pictures live on Ingredient Names.** `ingredients` gains `normalized_name`, `alt_names text[]`, `normalized_alt_names text[]` (GIN index) and `image_url`. No column records whether AI drew a picture: nothing read it, and no surface tells a reader. Migration `0053_ingredient_pictures`. Every path that mints a name writes its folded form; a startup backfill folds older rows in JavaScript.

**Matching is resolved at read time, in SQL.** `resolveIngredientPictures(ids)` returns each name's own picture, else a pictured name with the same folded form, else a pictured name whose `normalized_alt_names` contains it. `getRecipeFull` uses it, so recipe lines carry `picture: { imageUrl } | null` and the share view forwards it. Devices read `ingredients.list` (every name) and match with the same precedence; the editor suggests from every name, with or without a picture.

**Administration is admin-only.** `admin.ingredients.{list,create,update,delete,uploadImage,removeImage,generateImage,generateMissing,missingImageCount}`. `list` is paginated and searchable, with a per-name recipe count. Writes return discriminated outcomes (`duplicate` names the owner — same name case-insensitively, or an Alternative Name another name carries — `stale`, `not-found`, `invalid-name`). `delete` returns `in-use {recipeCount}` for a used name, mapped to `CONFLICT`.

**Pictures are versioned files**, drawn by the `ingredient-illustration` lazy queue (`{ ingredientId }`, one job id per name) and stored as before under `uploads/ingredient-images/`.

**Recipe writes invalidate the name lists.** Saving, importing, editing or deleting a recipe mints or re-counts Ingredient Names, so the realtime recipe handlers (`use-recipes-subscription`) invalidate both the device list and the administration list. The invalidation reaches every open client, including one whose administration panel is closed, so no screen needs a stale window of its own.

**Progress is polled; the editor suggests from the name part; hiding is a Hidden Item** — unchanged from the earlier catalog model.

## Testing Decisions

**Matching is tested against Postgres.** Repository tests cover own picture, same-fold match, Alternative Names added and removed, own picture outranking an Alternative Name, duplicate names and Alternative Names, in-use delete refusal, stale versions, pagination and filters, the normalized-name backfill, and an archive-shaped import that carries names rather than ids.

**The fold and the suggestions are pure and unit-tested** in `packages/shared`: matching, ranking, the exact-match exclusion, and rewriting only the name part.

**Storage runs real sharp** against a temp uploads directory: 512px WebP output, predecessor retention, sweeping, and nothing left behind when the entry is gone.

**The runtime test speaks the OpenAI image wire shape** and asserts the square size and the new prompt. The worker, producer and admin router are tested over mocks for their policy: prompt and shape, no-op on a vanished entry, unrecoverable errors, job dedupe, admin gating, precondition refusals and error mapping.

**The editor is tested in jsdom** for suggestion, partial rewrite, keyboard picking, Enter passthrough and the row picture; the illustration component for decorative alt text, error fallback, and Hidden Items inside and outside the shell.

**The browser E2E runs on the `ai` project** against the fake provider's image lane: an administrator finds a recipe's ingredient, draws its picture and gives it another name; the picture appears on lines written either way and on a hand-typed grocery; deleting the used ingredient is refused; the editor's suggestion rewrites only the name.

## Out of Scope

- **A seeded set of common ingredient pictures**, drawn once and shipped with Norish. A later migration can seed names and pictures the way Cuisines were seeded, without changing any of the matching.
- **The mobile app.** Recipe lines already carry the picture in their payload, so mobile thumbnails are a presentation change when they come.
- **Shop product images** as ingredient pictures, from the Store Product scraper.
- **Nutrition data** on Ingredient Names.
- **Per-locale alternative names** beyond what an administrator types.
- **Automatic pictures or Alternative Names** from imports or AI.
- **Realtime push** of picture changes to other open clients; they see changes on their next read.

## Further Notes

ADR-0037 records why a picture is a fact about a name. "Ingredient Linking" and "Ingredient Link" already mean Step Ingredients (CONTEXT.md), so this feature says "picture" and "Alternative Name" throughout.

The Pantry merged first, taking migration 0054 and ADR-0036, so this feature's migration is 0055 and its ADR is 0037.

Pictures are drawn in one style only as long as the prompt stays the same. "Generate missing" is not a restyle; a restyle-all action is a deliberate follow-up if anyone asks for it.
