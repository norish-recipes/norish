# 01: Upload an icon; recipe lines show it

**What to build:** The tracer bullet. In the Ingredient panel, a person who may edit a food uploads a picture. It is cut out to a 128px transparent WebP and held in the draft, and on Save it becomes the food's own Ingredient Icon. On a recipe page, each ingredient line shows its food's icon:

- the food's own icon if it has one;
- otherwise its nearest Parent Ingredient's (a red onion shows the onion's);
- otherwise a muted placeholder of the same size.

Headings show nothing. Remove, in the same draft, takes the food's own icon off again. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done, pending review

- [x] One migration gives an Ingredient a nullable own icon (a reference to a stored file). Nothing is added to recipe lines, groceries or Pantry rows.
- [x] A pure function turns picture bytes into a 128px square transparent WebP:
  - [x] it removes a flat background touching the edges by a flood from the border within a tolerance, so an interior patch of the same colour survives;
  - [x] it keeps a picture whose border is not one flat colour as it is;
  - [x] it only trims and fits a picture that already has transparency.
  
  It respects the image size limit and reads HEIC.
- [x] Icons are saved through their own WebP path (the existing path re-encodes to JPEG) under the uploads directory, with content-hash filenames.
- [x] One route serves icons at versioned, immutable addresses, excluded from the auth proxy.
- [x] One service answers, for a set of Ingredient ids, each food's icon address or none: own, then the nearest ancestor's own. It uses a recursive lineage query with a depth cap, and the choice is made in TypeScript (nutrition's lineage is the prior art).
- [x] `ingredients.icons({ ids })` exposes that service to the browser.
- [x] The Ingredient panel shows the food's icon. Clicking it offers Upload and Remove (Remove only for an own icon), both part of the draft. `saveDraft` gains an icon field (unchanged / new file / remove own) and Save attaches it. Controls show only with edit rights (the existing ingredient permission policy; a seeded food is an administrator's), and the server refuses otherwise.
- [x] One icon component with a fixed size scale (chip, line, panel up to 64px) and the placeholder. Recipe page lines use it, and headings get no slot.
- [x] Saving an icon invalidates the icons query.
- [x] Tests:
  - [x] the service against a real database (own; nearest ancestor's; none);
  - [x] the pure function over pictures sharp draws in the test;
  - [x] the router at the tRPC caller (who may upload and save, seeded foods administrator-only).

## Comments

2026-10-06 (implementation): own icons are content-hashed WebPs under `uploads/ingredient-icons/`; shipped and own icons share one route, `/ingredient-icons/<hash>.webp`, outside the auth proxy. The Ingredients page's rows and the panel read the shown icon off the list item (`icon`, `ownIcon`), resolved by the same service, rather than a second query. The panel's icon follows the Hidden Item like every other icon. The service already reads the shipped set (ticket 06), empty until then.
