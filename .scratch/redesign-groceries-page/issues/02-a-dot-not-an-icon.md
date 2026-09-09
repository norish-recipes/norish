# 02: A Store is marked by a dot, not an icon

Status: ready-for-human
Blocked by: 01

Spec: `.scratch/redesign-groceries-page/spec.md`

## What to build

Everywhere a Store shows its icon today, a 10px dot in the Store's colour stands instead: the section heading in the flat and grouped views, the Store selector in the Add and Edit grocery panels, and the store manager rows. Unsorted gets no dot, and neither does the selector's no-store option. The store editor loses its icon picker, so setting up a Store is its name, its shop link, its colour and its Aisles, in that order. The tinted heading background stays for now; ticket 03 takes it away.

The icon leaves the data too. One migration drops the column with its default. The create and update inputs, the server-side create default and the client's optimistic default stop naming it. A create that still sends an icon, over REST or from an older client, is accepted and the field ignored; the created Store carries none. Mobile never read it. Every test fixture that builds a Store stops naming it.

Prefactor inside this ticket: the flat section, the grouped section and the By Recipe section each carry their own copy of the heading markup. Extract one heading component the three share, taking the dot (or nothing), the name, the count, the total, the chevron and the kebab, so that ticket 03 restyles one place.

## Notes

- Vocabulary is CONTEXT.md's: Store, Unsorted. Do not introduce Badge or Icon as words in copy.
- The icon picker's label string leaves every locale.
- The store manager test that anchors the Aisles list "under the icon picker" is rewritten to anchor it under the colour picker.
- The tRPC stores tests move to a Store without an icon and gain the create-with-icon case; repository tests stop inserting the column.
- The docs still mention the icon picker after this ticket; ticket 06 rewords them.
- After editing the shared and database packages, refresh the injected `@norish` copies and remove the web build cache, copies first, before a build or an E2E run.

## Acceptance criteria

- [x] No Heroicon is rendered for a Store anywhere on the web; the heading (both views), the selector and the manager rows show the dot; Unsorted and the no-store option show none.
- [x] The store editor has no icon control; the Aisles list sits directly under the colour picker (component test).
- [x] One heading component is shared by the flat, grouped and By Recipe sections.
- [x] A migration drops the column; the Store DTO, the create and update inputs and the client defaults no longer carry an icon.
- [x] A create that sends an icon is accepted and the created Store has none (tRPC test); the public stores endpoint lists Stores without it.
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
