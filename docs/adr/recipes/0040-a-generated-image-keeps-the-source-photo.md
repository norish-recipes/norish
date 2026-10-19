# A Generated Image keeps the source image

Image Generation used to take the first position in a recipe gallery. A write did not keep the row and the file in that position (ADR-0025). That write did not keep the image from the cook. A Generated Image is an image of the dish. It has no value as a record. **A Generated Image now takes the first position. Each Source Image stays.** A Source Image is a gallery row from a person or a source. Its `generated` value is false. The new image is at position 0. Each Source Image has its row, its file, and its position. The write puts it behind the new image. A previous Generated Image can change, and the write does not keep it. Thus a recipe has one Generated Image at most.

The `recipes.image` column is a Source Image too. An old recipe can keep its only image there. The write can put that value in the gallery as the last row. Then it clears the column, because each person reads the gallery first. If the cap for Source Images is full, the column has the value. The write does not release the file. If the column names the Generated Image that the write changes, the write removes that file with the image.

Two results follow. First, a gallery can have ten Source Images and one Generated Image. The cap applies to Source Images only. The DTO accepts 11 rows. The schemas and the planner apply the same limits. A gallery with 12 rows fails. Second, "Generate Picture" adds an image to a full gallery. The action name shows what it does. The difference is that no image is lost.

The other part of the change is the thumbnail. The gallery has one position for each image. The image at position 0 is the first image. "Set as thumbnail" puts that image at the front. Then it gives a new position to each image in the gallery. Thus a person can put a Source Image in front of the Generated Image. No other value records the choice. A second record can be different from the first.

## Considered Options

- **Keep ADR-0025 and keep the removal** — The action cannot get the image back. Rejected: AI must never remove an image from a person.
- **Store the Generated Image outside the gallery** — A separate column keeps the gallery rows safe. Rejected: each person, the carousel, the Recipe Archive, the offline cache, and the Dish Colour already read the gallery. Each of them must read two image stores instead of one.
- **Add a `primary` value** — A boolean lets any image be the thumbnail, at any position. Rejected: the position already gives the result. Two records can be different after a new position.
- **Apply the ten-image cap to the Generated Image** — This keeps the cap at ten rows. Generation stops on a full gallery. Rejected: a cook with ten images cannot use the action. An error with no details is not better than one more row.

## Consequences

- The planner in `@norish/shared/lib/recipe-generated-image` decides the write. It decides the rows to remove and the rows to give a new position. It also decides the Source Image from the scalar and the files to remove. The transaction applies the decision. `storeGeneratedRecipeImage` removes only the files that no row uses.
- Eligibility does not change. A run with automatic settings and the usual sweep still do not touch a recipe that has an image. Only a manual action or an admin sweep with overwrite can write to a recipe with an image.
- A second run removes its previous image. Duplicate rows with the same URL keep that file while a remaining row names it.
- The Dish Colour follows the Generated Image, because the new image is the first image.
- A Recipe Archive now has 11 images when the recipe has a Generated Image. The other Norish has all of them.
- A write can remove a Generated Image, and no action can put it back. No run removes a Source Image.
- To change this decision, write a new ADR.
