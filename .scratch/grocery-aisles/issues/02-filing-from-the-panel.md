# 02 — Filing from the panel

Status: ready-for-agent
Blocked by: 01

Spec: `.scratch/grocery-aisles/spec.md` · Decision: ADR-0031

## What to build

A shopper opens a grocery's panel, on add or on edit, and directly under the Store selector finds an **Aisle** field, present only when the chosen Store has aisles and the name is non-empty. Its options are the Store's aisles in order plus "No aisle". It is pre-filled with what the Store remembers for the name as typed, re-reads when the Store is swapped, and writes nothing until the panel's own Save, at which point filing runs after the grocery is created or updated, and only when the choice differs from what the Store remembered.

Saving files the *name*: an **Aisle Link** for that Store and normalized name. The row moves under its aisle, and so does every same-named row at that Store, on every household member's screen. A renamed grocery is shown wherever the Store files its new name; a grocery moved to another Store is shown wherever that Store files it; a name no Store has been told about stays unfiled at the top. Removing an aisle in the store editor unfiles everything under it. Groups in the grouped view are per aisle per Store: "kip" filed in Vlees and "kip (diepvries)" filed in Diepvries are two groups.

Server side: one migration adds the aisle links table (store, normalized name, aisle; unique on store and name; cascade from aisle and from store). One query returns every Aisle Link of the household's Stores. One mutation files a name: Store, name as typed, aisle or null; folds the name with the Product Link's folding, requires household access to the Store, refuses an aisle that is not the Store's, upserts or deletes, last writer wins; emits one Store subscription event with store, normalized name and aisle-or-null. No REST endpoint.

Client side: a shared hook beside the prices hook answers which aisle a Store files a name under, from the query plus subscription merges keyed by store and normalized name, a null removing the entry; it is the only source of a grocery's aisle. The list resolves each row through it, the grouping function takes the resolver and includes the aisle in the group key, and the panel field reads and writes through it. The mutation goes through the same optimistic and outbox path as every grocery mutation, and the links query joins the persisted cache.

## Notes

- Nothing is stored on the grocery row and the server never computes an aisle onto one; mobile ignores the new query and field. That is the whole of ADR-0031.
- The two foldings differ on purpose: the Product Link's for the link key, the grouped view's for the group name.
- Prior art: the prices hook and its query for the derivation, the products procedures for filing, the grocery panels test for the field, the store products repository test for the link rules, the grocery prices E2E for the list.

## Acceptance criteria

- [ ] The Aisle field appears in the add and edit panels only when the chosen Store has aisles and the name is non-empty; it shows what the Store remembers, swaps with the Store, and writes nothing until Save (component tests).
- [ ] Filing writes one Aisle Link per Store and normalized name, last writer winning; null forgets; removing an aisle forgets its links; deleting a Store forgets everything; the household's links read in one query (repository tests).
- [ ] Filing under another household's Store, or into an aisle that is not the Store's, is refused; filing and unfiling emit a link event whose repeat merges as a no-op (tRPC tests).
- [ ] Filing one row moves every same-named row at that Store on every household screen; a rename and a store move re-derive; a removed aisle unfiles its rows.
- [ ] Groups are per aisle per Store in the grouped view.
- [ ] E2E: filing through the panel moves the row and its same-named sibling; removing the aisle returns them to the top; "kip" and "kip (diepvries)" become two groups once filed apart.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
