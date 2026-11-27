# 02 — The shared hooks send to Bring!

Status: ready-for-human
Blocked by: 01

Spec: `.scratch/bring-shopping-list/spec.md` · Decision: ADR-0041

## What to build

The logic both apps share learns the provider and the send, so a screen only has to show a different label.

`useGroceryListProvider` answers the instance's provider (`builtin` while loading) and follows the configuration announcement. `useBringHandoff` keeps a handoff ready for the lines picked while a sheet is open: it prepares one as soon as there are lines, rewrites it (`bring.update`, after 300 ms without another change) as the ticks, servings or edited lines change, and reports `idle`, `preparing`, `ready` or `failed`, so the button shows a spinner until the handoff holds the current list. Its `open`, called from the press, opens the deeplink synchronously with the platform's `openExternalUrl`, which answers whether the link was opened; when it was not (a browser blocked the tab) it shows a toast that stays until dismissed, **Open Bring!**, whose press opens it. A returned failure shows a warning with the message for its reason and a press tries again; a thrown error, offline included, shows the generic failure. A handoff left unopened is deleted (`bring.discard`) when the sheet goes.

In Bring mode the lines hook hands the picked lines (the edited name, amount and unit when there is one) with the recipe and servings to the handoff, creates no grocery, and the "on the list" relation is empty; "add at once" opens the panel instead of adding, because it cannot open Bring! without a press. Built-in mode is unchanged. The platform adapter gains `openExternalUrl`, which returns a boolean, and a `persistent` toast option; The whole `bring` router joins the routers the offline outbox never queues.

The admin configuration gains the provider and `setGroceryListProvider`, which rereads the admin settings and the provider query.

All locales carry the new strings: the setting's title, description, two options and notice, `groceries.bring.*`, and the recipe menu entries `detail.addToBring` and `addToBring`.

## Notes

- The phone app's platform adapter gains the new members and nothing else, so it typechecks; its screens are ticket 04.
- The Bring! procedures are never queued: a replayed one would point at a page that expired while the phone was offline.

## Acceptance criteria

- [x] `useGroceryListProvider` defaults to `builtin`, reads the query and is invalidated by the configuration announcement.
- [ ] `useBringHandoff`: prepares once there are lines; rewrites after a debounced change; is `ready` only when the handoff holds the current list; `open` opens the link through `openExternalUrl` and shows the persistent **Open Bring!** toast only when it answers false; maps each failure reason to its message and retries on the next press; shows the generic failure on a thrown error; discards an unopened handoff when the sheet goes.
- [ ] In Bring mode the lines hook gives the picked and edited lines to the handoff, creates no grocery and shows no built-in toast; in built-in mode it is unchanged.
- [ ] No `bring` procedure is captured by the offline outbox.
- [x] Every locale carries the new strings (`pnpm i18n:check`).
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test:run` pass.
