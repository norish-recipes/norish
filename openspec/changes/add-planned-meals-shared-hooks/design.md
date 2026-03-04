## Context

The current mobile Today section is intentionally isolated behind fixture data. Recipe hook extraction is now mostly shared, so planned-meals should follow the same factory + wrapper contract pattern.

## Decisions

1. Shared planned-meals hook family in `packages/shared-react`
   - Query hook(s) for fetching day slots/items.
   - Subscription hook(s) for realtime updates.

2. App-owned wrappers remain responsible for platform side effects
   - Web and mobile wrappers handle navigation/toasts/UI concerns.
   - Shared core owns query keys, cache updates, and payload normalization.

3. Replace fixture adapter after parity validation
   - Mobile Today section switches to shared hooks only after loading/empty/error/success states are validated.

## Migration Plan

1. Add shared planned-meals query/subscription core hooks.
2. Add thin wrappers in `apps/web` and `apps/mobile`.
3. Cut mobile Today section over to shared hooks.
4. Remove Today fixture runtime adapter.
