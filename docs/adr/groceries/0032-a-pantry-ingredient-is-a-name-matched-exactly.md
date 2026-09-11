# A Pantry Ingredient is a name matched exactly, and nothing is stored on the recipe or the grocery

A household wants a recipe's staples — olive oil, salt, flour — left off the grocery list, because it always has them. The obvious shapes are a flag on the recipe ingredient ("we have this"), a flag on the grocery ("do not buy"), or a fuzzy match of ingredient words against a list of staples. We chose none of them: a Pantry Ingredient is a household fact — an Ingredient Name the household has at home, owned by the member who typed it and read across the household exactly as a Store is — and an ingredient is in the pantry only when its folded name equals a Pantry Ingredient's, using the one folding a Product Link and an Aisle Link already use (case, diacritics, punctuation and whitespace, nothing else). Nothing is stored on the recipe ingredient and nothing on the grocery row.

The pantry is therefore consulted in one place, at one moment: when a recipe is added to the groceries. Its stocked lines are shown apart, unticked, and left off the list; a tick is the only way one gets on anyway, and that tick is for this adding and nothing more. A grocery that is on the list is on it: the Pantry never removes, hides or greys a line, and a name typed by hand into the list is added whether or not it is in the pantry, because a person who types "salt" wants salt.

The trade-off is deliberate: "extra virgin olive oil" in a recipe is not caught by "olive oil" in the pantry, and "salted butter" is never mistaken for "salt". A household that keeps a name in two spellings types it twice, and each spelling is remembered forever. Norish never guesses from words, and no AI is involved; a looser rule would have to be right about food, and being wrong costs a missing ingredient at the stove, which is worse than a spare one in the bag.

A Pantry Ingredient points at an Ingredient Name rather than carrying a name of its own, because a name in the pantry and a name on a recipe line are the same kind of thing: the row is `ingredient_id`, exactly as `recipe_ingredients` is, and typing a name Norish has not seen mints the Ingredient Name the way editing a recipe does. The fold lives on the Ingredient Name, so one name is folded once however many households hold it, and a name gains nothing by being in a pantry — no household owns an Ingredient Name, and removing a Pantry Ingredient leaves it where it was. The alternative, a name copied onto the row, was what this started as; it duplicated the fold per household and left two kinds of ingredient name in the schema for no reader-visible gain.

The Pantry travels on its own router and its own subscription rather than on the Store's: it belongs to no Store and is read where no Store is on screen, on the recipe page. There is no REST endpoint; it is a tRPC query and two mutations like product linking and aisle filing.

## Consequences

- A Pantry Ingredient is `(userId, ingredientId)`; the name and its fold are read from the Ingredient Name it points at, so every read of the Pantry joins `ingredients` the way a recipe line does.
- One Ingredient Name appears once per member, held by a row constraint. The looser rules — one *folded* name per member, and once per household — are held in the repository and the procedure, the way a Store name is, because two names that fold alike may still be two Ingredient Names and the rows span user ids.
- Deleting an Ingredient Name takes the Pantry Ingredients pointing at it, as it takes the recipe lines. Nothing else about a Pantry Ingredient outlives it.
- Matching is `normalizeGroceryName(ingredient) === item.normalizedName`, in one shared helper the add-to-groceries panel and the Pantry panel's duplicate check both ask; no other rule may be added beside it.
- The recipe ingredient and the grocery row carry nothing about the pantry; the add-to-groceries panel derives the split at render time, so a Pantry Ingredient added by a housemate reshapes the panel at once.
- The manual "Add Item" panel and the list itself are untouched by the Pantry; only adding a recipe consults it.
- Mobile ignores the router entirely until it has an add-recipe-to-groceries flow of its own.
