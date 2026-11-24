# The household is the permission boundary

A server's households need not know each other, and on a public or hosted instance they don't. Permissions built for one trusting family leak there:

- an administrator who passes every check reads every household's recipes;
- a deleted account's recipes, left ownerless and open to every reader, publish what was private;
- a household worked out from current membership carries a member's groceries into their next household;
- Tags and foods shared across the server let one household shape another's.

**The household is the boundary.** Every account is in exactly one household; a person on their own is a household of one. Household-owned rows carry the household's id rather than being derived from who is in it.

**One Permission Policy governs what crosses it:** who outside a household may view, edit and delete its recipes and cookbooks, each Everyone or Household. Nothing else a household keeps is ever offered, matched or changed outside it, whatever the policy. That covers its Tags, Cuisines, Categories and Ingredients (ADR-0042, ADR-0043), and its stores, groceries, pantry and meal plan.

A server administrator is an ordinary member under the policy. Their rights are over the instance: its settings, its accounts and the entries the instance itself ships.

Recipes and cookbooks belong to their Owner, as in a personal-sharing app. They leave with the Owner and are erased with the Owner's account. Everything else is the household's and stays.

## Considered Options

- **A policy per kind**: view, edit and delete for each of tags, cuisines, categories and ingredients. Every combination is an edge case, such as tags visible more widely than the recipes carrying them, or food teaching shared between households that the policy later separates. A policy switch would also have to split or merge data.
- **An Owner level** (only the member who added it). With household-shared groceries and pantry, a food or list only one member may see leaves housemates' rows pointing at things they cannot use. A household of one already gives a person their own space.
- **Workspace-owned recipes**, where leaving takes nothing, as in Slack or GitHub organisations. This needs no copy rules. It is rejected so that a person never loses their recipes by leaving a household.
- **Handing a deleted member's recipes to the household admin**, or leaving them ownerless and open to everyone. Erasing an account should erase its content, and an ownerless recipe every household can see is a leak.
- **An admin bypass for reading.** On a hosted server, the operator's Library would hold every household's recipes.

## Consequences

- Cookbooks reuse this policy (ADR-0027). The levels are Everyone and Household only, and edit and delete are never wider than view.
- A policy change never changes data. Some references exist only because reading across households was allowed: a cookbook holding another household's recipe, favourites, ratings, plan entries. These are hidden while the policy forbids them and come back when it widens.
- A recipe only ever carries its own household's entries. Editing another household's recipe (edit Everyone) therefore adds to that household's lists, never the editor's.
- Leaving a household moves the person's recipes and cookbooks and copies the household's names and foods they use. Joining from a household of one merges it into the joined household.
- The realtime household channel is keyed by household id.
