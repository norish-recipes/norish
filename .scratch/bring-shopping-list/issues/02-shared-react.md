# 02 — The shared hooks send to Bring!

Status: ready-for-human
Blocked by: 01

Spec: `.scratch/bring-shopping-list/spec.md` · Decision: ADR-0041

## What to build

The logic both apps share learns the provider and the send, so a screen only has to show a different label.

`useGroceryListProvider` answers the instance's provider (`builtin` while loading) and follows the configuration announcement. `useSendToBring` sends lines and gets the person to Bring!: it opens the deeplink with the platform's `openExternalUrl`, which answers whether the link was opened; when it was not (a browser blocked the tab) it shows a toast that stays until dismissed, **Open Bring!**, whose press opens the link. A returned failure shows a warning with the message for its reason; a thrown error, offline included, shows the generic failure. It resolves true only once Bring! took the lines.

In Bring mode the add-to-groceries hook sends the picked lines (the edited name, amount and unit when there is one) with the recipe and servings, shows no "ingredients added" toast, keeps the one-add-per-sheet guard (released after a failure), and the "on the list" relation is empty. Built-in mode is unchanged. The platform adapter gains `openExternalUrl`, which returns a boolean, and a `persistent` toast option; `bring.send` joins the procedures the offline outbox never queues.

The admin configuration gains the provider and `setGroceryListProvider`, which rereads the admin settings and the provider query.

All locales carry the new strings: the setting's title, description, two options and notice, `groceries.bring.*`, and the recipe menu entries `detail.addToBring` and `addToBring`.

## Notes

- The phone app's platform adapter gains the new members and nothing else, so it typechecks; its screens are ticket 04.
- `bring.send` is never queued: a replayed send would return a link that expired while the phone was offline.

## Acceptance criteria

- [x] `useGroceryListProvider` defaults to `builtin`, reads the query and is invalidated by the configuration announcement.
- [x] `useSendToBring`: opens the link through `openExternalUrl`; shows the persistent **Open Bring!** toast only when it answers false; maps each failure reason to its message; shows the generic failure on a thrown error; resolves true only on success.
- [x] In Bring mode the lines hook sends the picked and edited lines, creates no grocery and shows no built-in toast; in built-in mode it is unchanged; a failed send can be tried again.
- [x] `bring.send` is never captured by the offline outbox.
- [x] Every locale carries the new strings (`pnpm i18n:check`).
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test:run` pass.
