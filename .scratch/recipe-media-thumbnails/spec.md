# Recipe images: choose the thumbnail, keep the source image

Status: ready-for-human

## Problem

A recipe gallery can have several images. Two parts are not complete.

1. **The person cannot choose the thumbnail.** The gallery has a position for
   each image. The first image is the main image in the recipe view. A drag
   changes it, but no action has the name "set as thumbnail".
2. **AI Image Generation removes the source image.** `storeGeneratedRecipeImage`
   put another image in the main position and did not keep the row and file in that position. An
   image from a person or a source is the record. No run must remove it.

## Requirements

- The gallery shows a "set as thumbnail" action on each image after the first.
  That image must show in the recipe view.
- A Source Image (`generated = false`, or a value in the `recipes.image`
  column) keeps its row and its file after a Generated Image write. A Generated
  Image can change.
- One Generated Image at most, and ten Source Images at most. The schemas
  reject a gallery outside these limits.
- The write does not remove a file when a row, a scalar, or the new image uses
  it.
- The thumbnail has one record: the gallery position. No new column, no
  migration.
- The cap applies to Source Images. Thus a full gallery still accepts the AI
  image and can have 11 rows.
- The cap is atomic. Two uploads at nine Source Images cannot both pass.
- Tests that do not need PostgreSQL run in each unit step. The repository tests
  run in CI.

## Design

- `promoteImageToThumbnail` (in `@norish/shared/lib/recipe-media`) puts the
  image at the front and gives a new position to each image.
- `planGeneratedImageReplacement` (in
  `@norish/shared/lib/recipe-generated-image`) is one function that only
  decides the write. It decides the rows to remove, the rows to give a new
  position, the Source Image to move into the gallery, and the files to remove.
  It keeps the scalar when the cap is full.
- `addGalleryImageWithinCap` locks the recipe row, applies the cap, and adds the
  row in one transaction.
- `replaceRecipePrimaryImageWithGenerated` applies the decision in one
  transaction. `storeGeneratedRecipeImage` removes only the files the decision
  names.
- ADR-0040 has the decision and changes ADR-0025.

## Not in this change

- A new position from the recipe view (the recipe form has the position).
- A migration of the `recipes.image` column into the gallery. The write moves a
  scalar when Image Generation changes the recipe.
