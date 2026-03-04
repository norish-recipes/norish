## 1. Shared planned-meals core

- [ ] 1.1 Add planned-meals hook factory/binding contract in `packages/shared-react`.
- [ ] 1.2 Add shared planned-meals query hook(s) for Today slots/items.
- [ ] 1.3 Add shared planned-meals subscription hook(s) for realtime updates.
- [ ] 1.4 Add shared cache helpers for planned-meals list/day updates.

## 2. App wrappers and cutover

- [ ] 2.1 Add web thin wrappers over shared planned-meals hooks.
- [ ] 2.2 Add mobile thin wrappers over shared planned-meals hooks.
- [ ] 2.3 Replace mobile Today fixture adapter with shared planned-meals hooks.
- [ ] 2.4 Remove Today runtime fixture path from mobile dashboard.

## 3. Validation

- [ ] 3.1 Verify loading/empty/error/success behavior for mobile Today section.
- [ ] 3.2 Verify query keys and cache updates remain stable across web/mobile.
- [ ] 3.3 Run typecheck/tests for touched packages/apps.
