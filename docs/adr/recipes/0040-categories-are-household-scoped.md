# Categories are household-scoped, not instance-wide

Households asked for more Categories than Breakfast, Lunch, Dinner and Snack (issue #442: drinks, desserts, appetizers, side dishes). Categories are a `categories` table with a `recipe_categories` join, the same shape as `tags`, rather than the `recipe_category` enum. The four built-ins are fixed for everyone, and a household adds Categories of its own, kept until a member deletes one (ADR-0043). The list a person is offered is always the built-ins plus their household's Categories, whatever the Permission Policy. Categories render as a row of chips in the recipe form and the filters, and on a public instance a shared list would fill that row with every household's names. We rejected an administrator-owned list (the instance's Cuisines, ADR-0012), because one household's "Cocktails" is no reason to change every household's list, and the administrator of a public instance should not be curating a vocabulary for strangers.

## Consequences

- A household's Categories keep their own spelling, so one household's casing never shows in another's list. A recipe seen from another household still shows its own Categories.
- AI chooses among the recipe's household's list and never creates a Category. Other apps' imports match the built-ins and the household's Categories, and keep any other name as a Tag, so a large foreign taxonomy cannot flood the chip row. A Norish Recipe Archive carries its Categories over as they are.
- Meal plan slots have their own fixed enum. Only the four built-ins map to slots, for example in the random recipe picker.
