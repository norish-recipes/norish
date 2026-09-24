# 08 — WebSocket client transport: backoff with jitter, one unauthorized path, honest closes

**What to build:** in `packages/shared-react/src/providers/trpc-links.ts` and `trpc-provider.tsx`:

- `retryDelayMs` (`trpc-links.ts:340-348`) becomes full-jitter exponential backoff, `random() * Math.min(30_000, 1_000 * 2 ** attemptIndex)`, with the RNG injectable so tests are deterministic.
- An unauthorized close is close code `4401` only (the server sends it from ticket 06); delete the reason-string regex at `:118` and the message regex at `:154`. On 4401 the client stops retrying, fires `onWebSocketUnauthorized` once, and the latch is per client instance, so a client created after re-login retries normally.
- Every close, including a normal `1000`, reaches `onWebSocketClose` (fix the short-circuit at `trpc-provider.tsx:201-205`).
- `ConnectionStatus` drops the never-assigned `"connecting"`.
- Delete `shouldNotifyWebSocketDisconnect`, `getWsLazyEnabled`, `invalidateOnReconnect` (Recovery owns reconnect refetch, ADR-0011) and `onWebSocketClientDestroy` from the options type if nothing uses it.
- `TRPCLink<any>` at `:47, 48, 191, 200, 213` becomes `TRPCLink<TRouter>`; `TRPCClientContextValue` stops being `object | null` so `useTRPCClient()` consumers stop casting.
- `apps/web/app/providers/trpc-provider.tsx` passes an `onWebSocketUnauthorized` handler that routes to the sign-in flow.

`apps/mobile` is parked (01) and is not touched.

**Blocked by:** 06. Independent of 07.

**Spec:** `.scratch/realtime-foundation/spec.md` § Client

**Status:** ready-for-human

- [x] `packages/shared-react/__tests__/providers/trpc-links.test.ts`: attempts 0..6 fall within `[0, min(30000, 1000·2^n)]` and are not all equal; `4401` → no further attempt and the callback once; `1012` and `1006` → retry; a new client instance after a 4401 retries
- [x] A `1000` close reaches `onWebSocketClose`
- [x] No `TRPCLink<any>`; `ConnectionStatus` = `"idle" | "connected" | "disconnected"`; no `trpcClient as` cast in `apps/web`
- [x] Web passes `onWebSocketUnauthorized`; an expired session in a browser ends at the sign-in page rather than in a reconnect loop
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments

- Implemented on `claude/realtime-foundation-tickets-8ercvt` together with 07.
  - `webSocketRetryDelayMs(attemptIndex, random)` is exported from `trpc-links.ts`; the bundle takes `retryRandom` to inject the RNG. After a 4401 the client is closed (which is what stops tRPC reconnecting) and `retryDelayMs` returns 0 for the rest of that instance's life; the latch is a closure variable, so a bundle created after re-login retries normally.
  - `isUnauthorizedWebSocketClose` reads the close code only; `isUnauthorizedTRPCError` reads `data.code`/`httpStatus` only (its message regex went too). `isNormalWebSocketClose` stays for the provider's status.
  - `onWebSocketClose` fires for every close, and the provider maps it to `idle` (1000) or `disconnected` (anything else). The reconnect-invalidation effect, `invalidateOnReconnect`, `getWsLazyEnabled`, `shouldNotifyWebSocketDisconnect` and `onWebSocketClientDestroy` are gone; the provider still closes its socket on unmount.
  - `TRPCLink<TRouter>` everywhere in the bundle. tRPC types the transformer option on the router's client types, and for a generic router that conditional never resolves (this is why the old code said `TRPCLink<any>`, and why `httpBatchLink` had a standing type error). The HTTP links are therefore built against `AnyTRPCRouter`, which is assignable to `TRPCLink<TRouter>` without a cast.
  - `useTRPCClient()` returns `TRPCClient<TRouter>` and throws outside the provider; `offline-cache-controller.tsx` drops its `as OutboxMutationClient` cast.
  - The web provider's `onWebSocketUnauthorized` sends the browser to `/login?callbackUrl=<current path>`, the same shape `proxy.ts` uses for an expired session on an HTTP request.
  - Tests: `packages/shared-react/__tests__/providers/trpc-links.test.ts` (recorded `createWSClient` options: attempts 0..6 within bounds and not constant, 4401 once and no further attempt, 1012/1006 retry, a new instance after 4401 retries, a 1000 close reported). The old `src/providers/trpc-provider.test.ts` (the shim's cases) is deleted.
  - The browser check of an expired session ending at the sign-in page belongs to the release verification (ticket 10), for the same reason as 07.
