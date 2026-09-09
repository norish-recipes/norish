# 01: One hue table for web and mobile

Status: ready-for-agent
Blocked by: none (can start immediately)

Spec: `.scratch/redesign-groceries-page/spec.md`

## What to build

A household member opens the store editor and picks from eight swatches that are clearly different from one another, each announced by its colour's name: Green, Rose, Teal, Amber, Red, Grey, Blue, Violet. Every Store they already have keeps its colour, because the eight stored keys do not change; what changes is what each key looks like. The same Store shows the same hue on the web and on the phone, and two Stores that the phone used to draw identically are now distinct there. On the phone, Unsorted turns grey.

The table lives once, in the shared package, keyed by the existing colour keys, each entry holding a human name and a hex for light and for dark. No entry follows a theme token: the brand green is a fixed hex that matches the accent by eye and never moves with it. The web applies the colour through one CSS custom property set on each Store's section, and everything that already shows the colour today reads that property: the tinted heading, the icon disc, the picker swatches, the selector chip and the manager row. Dark mode reads the dark hex under the existing dark variant. Mobile deletes its own tint map and reads the table.

This ticket is the prefactor for the rest of the redesign: once the property is in place, the dot and the tinted checkboxes are one declaration each.

## Notes

- Vocabulary is CONTEXT.md's: Store, Unsorted. The mapping and the reasons are in the spec's Colour decision.
- The eight colour names are new strings in all fourteen locales; the picker's swatches use them as labels.
- The web colour map's unused `border` and `label` fields and the `as StoreColor` casts on the Store DTO's `color` field are the clutter to remove while here.
- Mobile compiles with the React Compiler: keep any hook alias `use`-prefixed.
- Per-package typecheck scripts pass `--noCheck`; run the compiler with `--noEmit --noCheck false` in the web and mobile packages to actually type-check the change.
- After editing the shared package, refresh the injected `@norish` copies under the web app's node_modules and remove the web build cache, copies first, before a build or an E2E run.

## Acceptance criteria

- [ ] The shared package exports the hue table keyed by the eight existing colour keys, and a pure test beside the aisle helpers' test asserts every key is present and no two keys share a light hex or a dark hex.
- [ ] The web reads the table through one CSS custom property per section; heading tint, icon disc, picker swatches, selector chip and manager row all show the new hues, in light and dark.
- [ ] The picker's eight swatches are labelled by colour name, and the names exist in all fourteen locales.
- [ ] Mobile reads the table, its own tint map is gone, its Unsorted section is grey, and it type-checks.
- [ ] A Store's stored colour value is unchanged by the update; no migration.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
