# Tags, Cuisines and Categories are household lists

Shared, ownerless rows for Tags, Cuisines and Categories cause three problems. Nobody can rename or delete an entry. Every household is offered every other household's Tags. One household's casing shows in another's. On top of that, creating an entry by typing it and sweeping it once unused leaves the lists impossible to manage.

**Each is a household list:**

- Rows carry their household and are unique on the folded name within it.
- Instance entries sit beside them: the four built-in Categories (fixed for everyone) and the administrator's Cuisines, which every household is offered.
- A recipe carries only its own household's entries and instance entries.
- Entries are added on the Content page, by an explicit "Create" in the recipe picker, and by AI under the permissive strategies. Imports add Tags, and a Norish Recipe Archive also adds its Categories. AI and imports match the list first.
- An entry stays until a member deletes it.
- Households may add Cuisines. AI's "extend" strategy adds to the recipe's household, never to the instance list.
- Filtering across households matches on the folded name.

## Considered Options

- **Names derived from the recipes carrying them**, with no stored list. That leaves no Add button and no entry kept between uses, so creating by typing would remain the only way in.
- **One shared row per name, with a household link to it,** to avoid storing "soja" 500 times. The link row costs as much as the name it replaces. A rename would become a re-link. The first household's casing would show in every other household's list.
- **Exact-case spellings.** "BBQ" and "bbq" should be one entry.

## Consequences

- Allergies are not tag rows. An account keeps them as names, matched against any recipe's Tags.
- Near-duplicates such as "BBQ" and "Barbecue" may coexist. Renaming one onto the other merges them.
- The upgrade gives every household its own copy of the shared Tag and Category rows its recipes use. The administrator's existing Cuisines become instance entries.
