# Ingredient catalogue AI controls

Status: ready-for-agent

## Problem Statement

When AI is enabled, the first boot of a release starts an AI pass over every food recipes brought in, and a spelling check over the seed, with no way to say no: a big, expensive job nobody asked for. Every newly minted food is asked about too, and every night the foods AI could not answer for are asked again. Nothing an administrator can switch decides any of it. Macros, density and piece weight come only from the datasets, so a food they miss stays without numbers for good. A food with no icon leaves an empty slot in the Ingredients list and a grey square in its panel. On a phone, the parent picker and the grocery store-product picker open their results below the input, where the keyboard leaves no room to pick one.

## Solution

1. **AI does nothing to the catalogue by default.** Admin → AI processing gets a new **Ingredient catalogue** item. It has one multi-select, **Automatic for new ingredients**, with four options, all off by default and all following the AI switch:
   - **Clean up new ingredients**: AI's existing pass on a minted food (merge, parent, Plain Name, split, not-a-food).
   - **Fill missing nutrition**: AI estimates the food's macros per 100 g where it has no numbers of its own.
   - **Fill missing conversions**: AI estimates the food's density and piece weight where it has none of its own.
   - **Draw missing icons**: the existing icon option, moved here. Offered only when image generation can draw.

   On a new food the clean-up runs first, then the fills and the icon, on whatever food the clean-up left (a merged food is not filled). With clean-up off, the fills and the icon run straight after the mint. The current "Automatic ingredients" switch in the AI config form goes.
2. **Nothing runs at boot or at night.** The first-start cleanup keeps its deterministic steps. Its AI step (asking about every askable food) and the boot spelling check go, and so does the nightly `ingredient-sweep`.
3. **An unanswered food is unreviewed, not flagged.** A minted food is no longer flagged as waiting on AI (`ai-queued`) or AI off (`ai-off`), and neither is one AI failed on. A flag means only that AI changed the food without being sure. Existing flags with those reasons are cleared at first start.
4. **Clean up catalogue.** A button in the Ingredient catalogue section opens a dialog with a scope, then shows how many foods it will ask about and asks for a confirm. The run is one job in the Job queue.
   - **Recipe foods**: the foods the current boot pass asks about, minted by someone's action, named by a recipe line, no person decided about them.
   - **Whole catalogue**: every listed food, seeded ones included, and for this run only, it ignores both a person's decisions (kept distinct, chosen name, chosen parent) and remembered undos. The markers themselves stay, so an automatic clean-up of a new food still respects them. A seeded food gets the spelling check, a merge or a parent, and is never deleted.
5. **Fill gaps.** A second button opens a dialog with three checkboxes (Nutrition, Conversions, Icons), each showing how many listed foods it would fill. It fills gaps only: no food that already has a value of its own gets a new one, a household's correction and a person's icon least of all. A broad group the shipped set deliberately leaves without an icon stays without one. Grocery-only foods are left out. It runs as one job, separate from Clean up catalogue.
6. **AI's nutrition and conversions.** One language-model call per food, through a new administrator-editable Prompt, asks only for what is missing and enabled. The answer is stored for the whole instance, ranks above what a parent would lend, below a household correction, the Norish fixes and the datasets, counts as borrowed for a recipe total's "estimated", and reads "Estimated by AI" where the source is shown. It is not an AI Change and gets no Decision Model check.
7. **The per-user Draw icons round goes.** The Draw icons control on the Ingredients page and its round are removed; Fill gaps is the one way to draw many. Drawing one food's icon from its icon menu stays.
8. **Icon placeholder.** In the Ingredients list rows and the food panel, a food that shows no icon shows a muted generic food glyph on the icon's rounded tile, in place of the empty slot and the grey square. Groceries and the pantry are unchanged.
9. **Pickers open above on phones.** One shared in-panel combobox opens its results above the input on a phone, with a capped height. The parent picker (`IngredientPicker`), the grocery store-product field (`GroceryProductField`) and the nutrition correction's food search use it.

## Decisions

- Off by default for every catalogue AI action. Upgrading instances stop AI catalogue work until an administrator opts in, which is called out in the Upgrade notes, with no compatibility code.
- The multi-select lives with the AI configuration. The settings stay in `AI_CONFIG.automaticIngredients`, which grows to `{ cleanUp, nutrition, conversions, icon }`.
- A whole-catalogue Clean up deliberately overrides a person's decisions and undos for that run (Mike: "no need for complex logic here"). Each change is still an AI Change with Undo.
- An AI estimate outranks parent lending (Mike, Q4 a): most missing foods have no parent or one that lends badly.
- Recipe-level nutrition estimation of left-out lines is unchanged and stays under its own switch.
- ADR-0037 is amended: the 2026-10-17 "after each mint, once at the first start, and nightly" and the 2026-10-20 "flagged as waiting on AI" are reversed.

## Out of scope

- Redrawing or re-estimating values a food already has.
- The plain dropdowns in panels (store, aisle): no keyboard, so they have no room problem.
- Recipe enrichment defaults (allergy detection stays on).

## Testing

- Unit: config defaults and parsing, mint gating per option, clean-up before fills, the two scopes' food sets (whole ignores markers and undos, never deletes seeded), fill-gap counts and gap-only writes, nutrition ranking with an AI value, the flag reasons gone.
- Web: the multi-select, both dialogs, the placeholder, the picker placement.
- E2E (`ai` project): Clean up catalogue on recipe foods; Fill gaps for nutrition. Picker on a phone viewport opens above its input.
- Docs: AI provider configuration, Ingredients and Ingredient icons pages; the 0.26.0-beta release notes' "AI keeps your ingredients tidy" section and an Upgrade note.

## Comments
