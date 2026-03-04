## 1. Shared Contract Foundations

- [ ] 1.1 Inventory the two existing recipe contexts and extract platform-neutral filter/domain logic into `shared-react` core modules.
- [ ] 1.2 Define the canonical recipe filter contract (keys, defaults, option metadata, and normalized payload shape) in `shared-react`.
- [ ] 1.3 Add compatibility exports for legacy context import paths to point to the shared implementation.

## 2. Context and Consumer Migration

- [ ] 2.1 Implement `shared-react` context providers/hooks as thin adapters over the shared domain core.
- [ ] 2.2 Migrate web recipe context consumers to shared entrypoints and remove duplicate local context wiring.
- [ ] 2.3 Replace mobile dummy filters with shared filter definitions and connect mobile flows to the shared context contract.
- [ ] 2.4 Wire mobile dashboard recipe modules to shared context selectors so new recipes appear through live updates.
- [ ] 2.5 Wire mobile search page to actual recipe data/query sources and remove placeholder/dummy data usage.

## 3. Loading UX Improvements

- [ ] 3.1 Create `components/skeletons/recipe-card-skeleton.tsx` for reusable recipe card placeholders.
- [ ] 3.2 Render recipe card skeletons for initial dashboard/search recipe list loads.
- [ ] 3.3 Render recipe card skeleton placeholders while new recipes are being added, then replace with live card data.

## 4. Validation and Cleanup

- [ ] 4.1 Add regression coverage for parity of filter defaults, updates, and serialized payloads between web and mobile.
- [ ] 4.2 Add mobile coverage for live dashboard/search updates and skeleton state transitions.
- [ ] 4.3 Validate shared modules do not require browser-only dependencies in mobile build/runtime checks.
- [ ] 4.4 Remove deprecated context duplication and finalize migration notes for compatibility export removal timing.
