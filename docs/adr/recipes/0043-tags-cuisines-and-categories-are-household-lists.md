# Tags, Cuisines and Categories are household lists

Tags, Cuisines and Categories were shared rows with no owner, unique across the server:

- Tags were created by typing them and swept when unused.
- Categories worked the same way (ADR-0040).
- Only an administrator could extend Cuisines (ADR-0012).

As a result nobody could rename or delete a Tag, and under the default policy every household was offered every other household's Tags. One household's casing also showed up in another's.

**Each is now a household list.**

- Rows carry their household and are unique on the folded name within it.
- Instance entries sit alongside them: the four built-in Categories, which are fixed, and the administrator's Cuisines.
- A recipe carries only its own household's entries and instance entries.
- Entries come from the Content page's Add, from an explicit "Create" in the recipe picker, from AI under the permissive strategies, or from imports. AI and imports match against the list first.
- An entry stays until a member deletes it.
- Households may add their own Cuisines.
- Filtering across households matches on the folded name.

## Considered Options

- **Names derived from the recipes carrying them**, with no stored list. That leaves no Add button and no entry kept between uses, and it keeps the creation-by-typing that made lists hard to manage.
- **One shared row per name, with a household link to it,** to avoid storing "soja" 500 times. The link row costs as much as the name it replaces, and a rename becomes a re-link. The first household's casing would also show in every other household's list.
- **Exact-case spellings.** "BBQ" and "bbq" should be one entry.

## Consequences

- Supersedes ADR-0012 in part: households extend Cuisines, and AI's "extend" strategy adds to the recipe's household, never to the instance list.
- Supersedes ADR-0040 in part: Categories now persist until deleted and are created explicitly. They are still offered only to their household.
- Allergies stop being tag rows. An account keeps them as names, matched against any recipe's Tags.
- Near-duplicates such as "BBQ" and "Barbecue" may coexist. Renaming one onto the other merges them.
- The upgrade gives every household its own copy of the shared Tag and Category rows its recipes use. Today's Cuisines become instance entries.
