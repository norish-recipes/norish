# 01 — Choose the thumbnail and keep the source image

Status: ready-for-human

## What to build

- A "set as thumbnail" action in the recipe image gallery. It puts that image
  at the front and gives a new position to each image.
- A Source Image stays after Image Generation. A previous
  Generated Image can change. The write does not remove a file that a row uses.
- Schema limits for ten Source Images and one Generated Image, and an atomic
  cap.

## Done when

- [x] The thumbnail control on an image after the first makes it the thumbnail.
- [x] After the new position, `primaryRecipeImage` gives that image.
- [x] A Generated Image write keeps each `generated = false` row and its file.
- [x] A Generated Image write removes a previous `generated = true` row and its
      file.
- [x] An image that only the `recipes.image` value has becomes a Source Image
      row.
- [x] The write does not remove a file that a remaining row or the new image
      uses.
- [x] The schemas reject 11 Source Images and two Generated Images.
- [x] Two new images at nine Source Images cannot both pass.
- [x] `pnpm i18n:check` passes with the new key in each locale.
- [x] ADR-0040, the release notes, and the recipe view agree with this change.

## Notes

- The planner, the thumbnail function, and the image code have unit tests.
- The `test` entry in `@norish/db` runs the repository tests in CI, where
  PostgreSQL is available.
