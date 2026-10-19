# A Generated Image takes the recipe's primary slot

Norish's precedence rule is that Supplied Recipe Data outranks what AI produces, and every enrichment kind so far has honoured it cheaply, by writing text a person could retype in a minute. Image Generation cannot. What it produces is a hero image, the slot it wants is order 0 in the gallery, and what may already be sitting there is a photograph the cook took of their own dinner. **A write puts the Generated Image at order 0, so it is the recipe's primary image when it is written. A person can choose another thumbnail, which moves the Generated Image behind that image.** A recipe therefore holds at most one Generated Image, and every Source Image keeps its contents and its relative order behind it (ADR-0040).

Eligibility is the counterweight, and it is absolute where it matters: an automatic run skips a recipe holding any image at all, so nothing is ever destroyed by background work, by a newly imported recipe, or by a default bulk sweep. Exactly two acts can reach a stored image — an editor choosing the action on one recipe, and an administrator turning on "Overwrite existing data" for the whole library — and both are already the deliberate, destructive path in their own surface. Neither asks a second time. What the sweep does ask is how many images it is about to generate, named as a number before it starts, because this is the one kind whose cost is per recipe and visible on a bill.

## Considered Options

- **Demoting rather than deleting** — insert at order 0 and slide the photograph to order 1. Nothing is lost, and undoing a library-wide sweep then means reordering several hundred galleries by hand while every recipe card in the product shows a rendering in the meantime. Rejected: a write nobody can practically undo is not the safer option, it is the same outcome with more clutter.
- **Never displacing a supplied photograph** — replacement consumes a previous Generated Image and nothing else. Safe by construction, and it makes the manual action refuse the precise case it exists for: a cook with an unflattering photograph asking for a better-looking one.
- **Confirming on the manual action**, the way deleting a recipe does. Rejected: the action says what it does, bulk already confirms, and a dialog on every single-recipe generation taxes the common case to guard the rare one.

## Consequences

- Restoring a deleted photograph is not possible. Norish has no trash and `deleteImageByUrl` unlinks the file, so a cook who wants theirs back re-uploads it. This is the only irreversible act in Recipe Enrichment.
- The `recipe_images` marker that makes a Generated Image nameable decides nothing here: eligibility asks only whether an image exists, replacement consumes the slot whatever is in it, and no surface labels it. It survives for one reason — a Recipe Archive carries it, so a receiving instance is told which of the images it just accepted was drawn rather than photographed.
- Replacing the primary changes the Dish Colour (ADR-0023), so a run recomputes it from the image it just wrote. A recipe page tinted from a rendering is the correct outcome: the tint follows the primary image, never the provenance of it.
- `enrichmentWriteMode` decides nothing for this kind either. Every run that reaches a worker replaces, and it is eligibility rather than the write mode that keeps automatic runs off stored images — the mirror image of Ingredient Linking, which is a gap-filler in its write and unconditional in its eligibility.
- The bulk sweep's default remains honest: with "Overwrite existing data" off it only ever fills gaps, so an administrator can sweep a library for missing images without risking a single stored photograph.
- Letting an automatic or default-sweep run reach a stored image reopens this ADR. Changing the manual action to spare one does too, in the other direction.

## Amendment

**ADR-0040 changes this decision.** A Generated Image is still at position 0, and a recipe has one at most. A write does not remove the row and the file in that slot. A Source Image is behind the Generated Image. The write removes only a previous Generated Image.
