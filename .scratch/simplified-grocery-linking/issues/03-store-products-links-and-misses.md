# 03 — Store Products, Product Links and Misses

Status: ready-for-human
Blocked by: 01

Spec: `.scratch/simplified-grocery-linking/spec.md`

## What to build

The two tables the feature remembers things in, their repositories, and the tRPC surface over them.

`store_products` — belongs to a Store: `name`, nullable `pageUrl`, `price`, `currency`, nullable `size`, `pricedAt`, `isManual`, version column. Unique on `(storeId, pageUrl)` where `pageUrl` is present, so the same shop page is never two products.

`store_product_links` — the Product Link: `storeId`, `normalizedName`, nullable `storeProductId`, `triedAt`, version column. Unique on `(storeId, normalizedName)`. A row with no product **is** the Miss; there is no separate table and no reason column.

Repositories cover: resolve a link for a `(store, name)` pair, upsert a link, upsert a product read from a page, create and edit a manual product, list a Store's products, and read the products for a set of groceries in one query.

## Notes

The link is keyed by name rather than by grocery id on purpose — that is the whole reuse story, and it is why renaming a Grocery asks a new question instead of carrying the old answer. Normalization is the same folding the auto-link rule uses in ticket 04 (case, diacritics, punctuation, collapsed whitespace); write it once, in `@norish/shared`, and use it from both.

Links are last-writer-wins with no version guard: the last human to choose is right. Products keep their version column because two refreshes can land at once.

A manual product has `isManual` true and no `pageUrl`, and nothing in the refresh path may ever touch one. Enforce that where products are written, not only where they are refreshed.

Deleting a Store cascades to both tables. Deleting a Grocery touches neither — that is the point.

Follow the repository convention (`packages/db/repositories/`); no router-level queries.

## Acceptance criteria

- [x] Both tables exist with their unique constraints and a migration.
- [x] `(storeId, pageUrl)` cannot hold two products; `(storeId, normalizedName)` cannot hold two links.
- [x] Resolving a link for a known name returns its product in one query; for an unknown name it returns nothing.
- [x] A link with no product reads as a Miss and carries its `triedAt`.
- [x] Upserting a product read from a page updates price, currency, size and `pricedAt`, and leaves a manual product untouched.
- [x] A manual product can be created and edited by any household member and has no `pageUrl`.
- [x] Reading products for a list of groceries is one query, not one per grocery.
- [x] Deleting a Store removes its products and links; deleting a Grocery removes neither.
- [x] Name normalization lives in one shared place and folds case, diacritics, punctuation and whitespace.
