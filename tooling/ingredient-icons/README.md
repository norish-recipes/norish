# Ingredient Icons tool

Draws the Ingredient Icons Norish ships for its seeded foods into
`packages/shared-server/src/ingredients/icon-set/`. Uses the database in
`.env.local` and that instance's Image Generation provider and Decision Model.

```sh
# Contact sheet of ~20 foods, to check the style: out/sample-sheet.png
pnpm --filter @norish/ingredient-icons-tool draw-sample-icons

# Say how many icons are left to draw, then draw them
pnpm --filter @norish/ingredient-icons-tool draw-icons --tier low
pnpm --filter @norish/ingredient-icons-tool draw-icons --tier low --yes
```

Foods that would look like their parent's icon borrow it instead of being
drawn; `shares.json` remembers which. A stopped run resumes. Commit the icons,
`manifest.json` and `shares.json`.
