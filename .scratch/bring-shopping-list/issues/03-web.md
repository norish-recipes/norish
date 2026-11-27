# 03 — The web app uses Bring! as the shopping list

Status: ready-for-human
Blocked by: 01, 02

Spec: `.scratch/bring-shopping-list/spec.md` · Decision: ADR-0041

## What to build

An administrator opens **Settings**, **Admin**, **General** and finds **Shopping list**: a choice between the Norish grocery list and Bring!, saved at once, with the notice that Bring!'s servers fetch a temporary public HTTPS page when Bring! is chosen.

With Bring! chosen, every signed-in member sees the Groceries tab leave the navigation, with the remaining tabs keeping their order and the mobile navigation its column count; the page is read on the first frame, so it never flashes. `/groceries` and everything under it redirect to the home page, on the server and, for someone already on the page when the setting changes, on the client. Every "add to groceries" action (the planning panel, the recipe page's actions menu, the recipe card's menu) is labelled **Add to Bring!**, the panel's button too; ticking, editing in place and the pantry split are unchanged, and the panel hands the lines with the recipe and servings to a Bring Handoff instead of creating groceries. The handoff is prepared when the panel opens; every change of ticks, servings or edited lines disables the button with a spinner and, after 300 ms, rewrites it, and the button is enabled once the handoff holds the current list. One press only opens Bring! in a new tab without an opener, or with `location.assign` in an iOS Home Screen app, where a new window is an in-app browser that never hands the link to Bring!. Only if the browser blocked that tab does the press end in the persistent **Open Bring!** toast, whose button opens the link the same way. Closing the panel without opening Bring! deletes the handoff. "Add at once" after planning opens the panel in Bring mode.

`GET /share/bring/<token>` is the public page Bring! fetches: 404 with no body for a malformed, unknown or expired token (a malformed one never reaches Valkey); otherwise a title, the lines, and the same content as schema.org Recipe JSON-LD with the recipe's primary picture (the Norish icon when there is none). The picture is `/share/bring/<token>/image` for one the instance stores, a public route that serves the file with `Cache-Control: private, no-store` and answers 404 otherwise, or the `https` address of an imported one. The page and the picture expire with the handoff after an hour. It answers with `noindex`, no-store, no-referrer, `default-src 'none'` and `nosniff`, and shows no user, household, recipe id or link, and no media but that picture.

Switching back restores the tab and every grocery.

## Notes

- `/share/**` is already outside the sign-in redirect in `proxy.ts`; a test pins that `/share/bring/<token>` stays unproxied. A reverse proxy must let `/share/bring/` (page and `/image`) through without login, VPN or bot protection; one that lets `/share/` through covers it.
- The E2E needs a fake Bring! (`harness/fake-bring.ts`) that records the request and fetches the page it was given, wired through `BRING_API_URL` in the production stack harness.
- After editing shared packages, refresh the injected `@norish` copies and remove the web build cache, copies first, before a build or an E2E run.
- The docs page (`/groceries/bring`) shows the admin setting and the **Add to Bring!** panel.

## Acceptance criteria

- [ ] The admin card selects the provider, saves immediately and shows the notice only for Bring!.
- [ ] In Bring mode the Groceries tab is absent from the navbar and the mobile navigation, the other tabs keep their positions, and a live switch updates both without a reload.
- [ ] `/groceries/**` redirects home on the server and on the client in Bring mode.
- [ ] The planning panel, the recipe actions menu and the recipe card menu say **Add to Bring!**; the panel prepares a handoff with the recipe and servings and never calls the built-in create.
- [ ] The button shows a pending state until the handoff holds the current list; the press opens the link at once (new tab with the opener cut, `location.assign` in an iOS Home Screen app) and falls back to the persistent **Open Bring!** toast only when the tab was blocked; closing the panel unopened deletes the handoff.
- [ ] The public page answers 404 for a malformed or unknown token and otherwise 200 with the headers, the lines and the JSON-LD; the image route serves a stored picture with `private, no-store` and answers 404 otherwise; the proxy leaves both alone.
- [ ] E2E: switching the provider removes the tab live; `/groceries` redirects; adding a recipe's lines opens the fake's deeplink; the fake received the ticked lines as a schema.org Recipe; a bad token answers 404; switching back restores the tab and the data.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
