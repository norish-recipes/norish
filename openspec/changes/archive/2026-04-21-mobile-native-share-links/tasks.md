## 1. Shared Share-Creation Contract

- [x] 1.1 Extend the shared-react recipe-share mutation hook to expose an async share-creation path that returns the confirmed share-create response while preserving existing cache invalidation.
- [x] 1.2 Update the shared recipe detail context types and provider wiring so mobile consumers can trigger share creation and receive the created Norish share URL.

## 2. Mobile Share Flow

- [x] 2.1 Update `apps/mobile/src/components/recipe-detail/recipe-actions-menu.tsx` so Share creates a `forever` public share link and passes the returned Norish URL into the native share sheet.
- [x] 2.2 Add pending and error handling for the mobile Share action, and ensure failures do not fall back to sharing `recipe.url`.
- [x] 2.3 Keep the existing Visit Original behavior intact as a separate action for recipes that have a source URL.

## 3. Verification

- [x] 3.1 Add or update tests for the shared-react share-creation contract to cover returning the created share payload.
- [x] 3.2 Add or update mobile tests for the recipe actions menu to verify Share uses the Norish public URL and that share-creation failures do not share the source URL.
