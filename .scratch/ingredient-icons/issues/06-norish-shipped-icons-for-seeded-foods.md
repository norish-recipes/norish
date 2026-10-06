# 06: Norish's shipped icons for seeded foods

**What to build:** Norish ships an Ingredient Icon for the foods its catalogue is seeded with. A seeded food with no icon of its own shows the shipped one for its Open Food Facts entry, and its children borrow it. An icon a person sets outranks the shipped one and survives a new release, and removing it brings the shipped one back. Vague groups (fruit, vegetable, dairy…) are listed as drawn none. This ticket builds the mechanism with a handful of placeholder icons; ticket 09 commits the real set. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The set lives as data in a workspace package, which the Docker image already copies. Its manifest maps `off_id` to a file and lists the `off_id`s deliberately drawn none.
- [ ] The service's order becomes: own, then shipped for the food's `off_id`, then the nearest ancestor's own or shipped icon. A food adopted by the seed later gets its shipped icon with no extra step.
- [ ] The icon route serves shipped files at versioned, immutable addresses (the file's hash), so a restyled set reaches readers past the service worker's cache-first image cache.
- [ ] The placeholder set holds a few icons, enough for tests and dev, and is replaced wholesale by ticket 09.
- [ ] Tests (the service against a real database, with a fixture manifest):
  - [ ] own outranks shipped;
  - [ ] shipped by `off_id`;
  - [ ] a child borrows the parent's shipped icon;
  - [ ] removing an own icon brings the shipped one back;
  - [ ] a "drawn none" group has none.
