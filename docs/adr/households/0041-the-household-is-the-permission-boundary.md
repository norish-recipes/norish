# The household is the permission boundary

Norish's permissions assumed one trusting family per server. The server admin passed every check, reads included. A deleted account's recipes became Orphaned, readable and editable by everyone. "Household" was worked out from who was in it at query time, so a member's groceries and stores followed them into their next household and were deleted with their account. Tags, Cuisines, Categories and Ingredients were shared server-wide. None of that survives a server whose households don't know each other, which is every public instance and the whole case for a hosted one.

**The household is the boundary.** Every account is in exactly one household, and a person on their own is a household of one. Household-owned rows carry the household's id instead of being derived from membership.

**One Permission Policy governs what crosses the boundary.** It says who outside a household may view, edit and delete its recipes and cookbooks, each set to Everyone or Household. Everything else a household keeps is never offered, matched or changed outside it, whatever the policy. That covers its Tags, Cuisines, Categories and Ingredients (ADR-0042, ADR-0043), and its stores, groceries, pantry and meal plan. A server administrator is an ordinary member under the policy; their rights are over the instance, not past a household.

Recipes and cookbooks belong to their Owner, as in a personal-sharing app. They leave with the Owner and are erased with the Owner's account. Everything else is the household's and stays.

## Considered Options

- **A policy per kind**, with view, edit and delete for each of tags, cuisines, categories and ingredients. This was the first ask. Every combination is a new edge case: tags visible more widely than the recipes carrying them, or food teaching shared between households that the policy later separates. A policy switch would also have to split or merge data.
- **An Owner level** (only the member who added it). With household-shared groceries and pantry, a food or list only one member may see leaves housemates' rows pointing at things they cannot use. A household of one already gives a person their own space.
- **Workspace-owned recipes**, where leaving takes nothing, as in Slack or GitHub organisations. This needs no copy rules. It was rejected so that a person never loses their recipes by leaving a household.
- **Handing a deleted member's recipes to the household admin**, or keeping the Orphaned state. Erasing an account should erase its content, and an orphan every household can see is a leak.
- **An admin bypass for reading.** On a hosted server, the operator's Library would hold every household's recipes.

## Consequences

- Supersedes ADR-0027 in part: cookbooks still reuse the recipe policy, but the server admin no longer bypasses it and nothing becomes Orphaned. The levels are Everyone and Household only. A stored `owner` level becomes Household, and edit and delete are never wider than view.
- A policy change never changes data. Some references exist only because reading across was allowed: a cookbook holding another household's recipe, favourites, ratings and plan entries. These are hidden while the policy forbids them and come back when it widens.
- A recipe only ever carries its own household's entries. Editing another household's recipe (edit Everyone) therefore adds to that household's lists, never the editor's.
- Leaving a household moves the person's recipes and cookbooks, and copies the household names and foods they use into the new household. Joining from a household of one merges that household into the one joined. The realtime household channel is keyed by household id.
- Upgrades split the rows households used to share (ADR-0042, ADR-0043) and hand existing orphans to the server owner's household.
