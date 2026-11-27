# 01 — The server hands lines to Bring!

Status: ready-for-human
Blocked by: none (can start immediately)

Spec: `.scratch/bring-shopping-list/spec.md` · Decision: ADR-0041

## What to build

An administrator can set the instance's **Shopping List Provider** to the built-in list or to Bring!, and a signed-in member can send lines to Bring! and get its import link back.

The provider is the `grocery_list_provider` configuration key, `builtin` by default, read through `config.groceryListProvider` and changed through `admin.updateGroceryListProvider`, which announces the change like the other general settings and is refused for anyone but an administrator. Restoring the default announces it too.

`bring.send` takes the lines, optionally a recipe and the servings they are scaled to. Outside Bring mode it answers `not-bring` and makes no request. Otherwise it checks access to the recipe and uses its name as the title, checks the instance is reachable from the internet (an HTTPS `AUTH_URL` that is not, and does not resolve to, a private address; skipped only when `BRING_API_URL` is not Bring!'s own address), counts the send against a per-person limit of thirty in ten minutes, stores the formatted lines as a **Bring Handoff** under a 24-byte base64url token for one hour, and asks Bring! for the deeplink of the page at `/share/bring/<token>`. Every expected failure is returned as a reason: `not-bring`, `not-public`, `bring-unreachable`, `bring-rejected`, `rate-limited`. The page itself is ticket 03.

`BRING_API_URL` is the Bring! address, `https://api.getbring.com` by default; it exists so a test can stand in for Bring!, and a different value also turns off the reachability check and allows an `http` deeplink.

## Notes

- Contracts live in `packages/shared/src/contracts/zod/bring.ts`; the handoff, line format, page markup, Bring! client and reachability check in `packages/shared-server/src/bring/`; the router in `packages/trpc/src/routers/bring/`.
- A line is "amount unit name", amount at most two decimals, whitespace collapsed, capped at 200 characters. The stored record is title, servings, lines and creation time: nothing about who sent it.
- Neither the token nor the page address is logged.
- The rate limit reuses the fixed-window counter the auth package already has.

## Acceptance criteria

- [x] The provider key is seeded to `builtin`, validated as `builtin | bring`, read by every signed-in client and changed only by an administrator, with the change announced (tRPC tests).
- [x] `bring.send` outside Bring mode returns `not-bring` and makes no Bring! request.
- [x] A private or non-HTTPS `AUTH_URL` returns `not-public` unless `BRING_API_URL` points at a stand-in for Bring!.
- [x] A recipe the person cannot access is refused; its name becomes the title.
- [x] The thirty-first send in ten minutes returns `rate-limited`.
- [x] A success stores the formatted lines for an hour and returns the deeplink; Bring! timing out or answering 5xx returns `bring-unreachable`, a 4xx or an unreadable answer `bring-rejected`.
- [x] The line format, the page markup (including a `</script>` in a line) and the handoff store are covered by unit tests.
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test:run` pass.
