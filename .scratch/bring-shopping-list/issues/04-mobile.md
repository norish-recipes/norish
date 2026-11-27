# 04 — The phone app follows the shopping list provider

Status: ready-for-agent
Blocked by: 01, 02

Spec: `.scratch/bring-shopping-list/spec.md` · Decision: ADR-0041

## What to build

With Bring! chosen, the phone app stops offering the built-in list and sends to Bring! like the web does. Phase 2 of the feature: the server and the shared hooks already exist, and the app's platform adapter already opens an external address unprompted, so the app opens Bring! straight after a send.

- Hide the Groceries tab when the provider is Bring!, so the remaining tabs keep their order.
- Redirect the groceries stack to the home tab, for someone already inside it when the setting changes and for a deep link into it.
- Relabel every add-to-groceries screen **Add to Bring!** (title and button), and the recipe menu entries, with the strings the shared package already carries.
- Pass the recipe and the servings to the shared lines hooks (`useLinesToBuy` source, `useAddAtOnce`) so the title and the scaled amounts reach Bring!.
- Keep the pantry split, selection and edit-in-place of the screens as they are.

## Notes

- Until this ships the app's platform adapter says `supportsExternalShoppingList: false`; lift it here, and the shared `useGroceryListProvider` follows the setting again.
- Read the provider with `useGroceryListProvider`; it answers `builtin` while loading, so an instance on the built-in list never flickers.
- A send is never queued offline; show the shared hook's failure and let the person try again.
- Update the Bring! docs page and the mobile page when this ships: today they say the app follows in a later release.

## Acceptance criteria

- [ ] In Bring mode the Groceries tab is absent and the groceries stack redirects to the home tab; in built-in mode nothing changes.
- [ ] Every add-to-groceries screen and menu entry says **Add to Bring!** in Bring mode.
- [ ] Sending from a recipe passes the recipe and servings, opens Bring! at once on success and shows the shared failure message otherwise.
- [ ] A live switch by the administrator updates the tab bar without restarting the app.
- [ ] The docs say the app follows the setting.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm i18n:check` pass.
