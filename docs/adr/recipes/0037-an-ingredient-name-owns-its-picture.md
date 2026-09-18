# An Ingredient Name owns its picture

A reader who recognises pictures faster than words wants a small picture beside each ingredient, in one consistent style, which only a generated set can supply. The question is what a picture is *about*, and everything else follows from the answer.

**A picture is a column on the Ingredient Name row, and a line shows the picture of the row it points at.** That is the whole rule. `recipe_ingredients` already carries `ingredient_id`; the picture is read along the foreign key that is already there, with the name, in the query that already runs.

Nothing resolves a picture from text at read time on the server. The one place text is matched to a picture is a grocery row, which has no `ingredient_id` because a member typed it — and there the match is the grocery folding under `normalizeGroceryName`, exactly as the Pantry matches (ADR-0036), computed in the browser against a cached list so it works offline.

## Considered Options

- **Resolving the picture at read time** from the line's text — a line shows its own name's picture, else that of a name folding the same. Rejected. It spends a lateral join on every recipe read, and a bespoke resolution ladder in the browser, to answer a question the write already answered when it chose the row. It also means a Pantry Ingredient, a Product Link and an Aisle Link each match by a different rule from the picture beside them.
- **A separate administrator-owned catalog** of entries with their own names, linked to Ingredient Names by a stored foreign key recomputed on every catalog write. It doubles the vocabulary and needs a relink on every write, for a distinction — "the name a recipe typed" versus "the ingredient it means" — that `ingredient_id` already collapses.
- **A link per recipe line**, a nullable picture id on `recipe_ingredients` set by autocomplete or exact match on save. The line already has that link: `ingredient_id` is it.
- **Fuzzy or word-subset matching** for the grocery row, so "extra virgin olive oil" finds "olive oil". It shows the wrong picture whenever the longer name is a different thing ("coconut milk" is not milk). Rejected, as ADR-0036 rejects it for the Pantry.
- **Per-household pictures.** Pictures are drawn once per deployment and cost money per picture; households differ in what they cook, not in what an onion looks like. Rejected.
- **Recognising that one food is here under two names** — "aubergine" and "eggplant" as separate rows, each drawn and billed separately. That is real, and it is a matching problem rather than a picture problem: it is about which row a name resolves to, which this ADR does not touch. Deliberately left to a decision of its own, so that a change to matching is reviewed and reverted as matching, not as pictures.

## Consequences

- A recipe line shows the Ingredient Name it points at, and that name's picture. A recipe saying "olive oil" reads "Olive Oil" when that row was minted first, which is the collapse `ingredients` already performed before pictures existed.
- Readers get the picture two ways, both of them a column read: a recipe's lines carry `ingredients.image_url` from the server, which is what makes the public share page work; a grocery row, which has only text, folds that text against a cached list of every Ingredient Name and shows that ingredient's picture, which covers hand-typed groceries and Offline use.
- The editor suggests from the same cached list, matching on the name as typed, and inserts the Ingredient Name.
- An Ingredient Name carries a stored folded form, which the Pantry needs (ADR-0036) and the grocery row's match agrees with. Names written before it are folded by a startup backfill in JavaScript, not by a SQL approximation, so a name folded on the server and one folded in a browser always agree.
- Pictures are drawn by the AI Runtime's existing third entry point (ADR-0024) with an administrator-editable Prompt and a square shape, from the name alone. A picture is a versioned, immutable file (ADR-0021), served outside the auth proxy because it carries no household data.
- A name a recipe uses, or a household keeps in its Pantry, cannot be deleted — the foreign key would delete those rows with it — so the administration refuses and says what uses it.
- Only names a recipe uses are drawn in a "generate missing pictures" run. A name nothing points at is not billed for.
- Nothing about a picture is stored on a line, so a Recipe Archive carries names only (ADR-0022) and a receiving instance resolves them against its own ingredients.
- Nothing records whether AI drew a picture or a person uploaded it: no rule and no surface acts on the difference. A later restyle would redraw every picture rather than only the drawn ones.
- Resolving a picture anywhere but from the row a line points at reopens this ADR.
