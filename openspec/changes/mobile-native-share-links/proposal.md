## Why

Norish already has backend and shared-react support for public recipe share links, but the mobile app still shares the source recipe URL instead of a Norish-owned public share URL. This leaves mobile users with an inconsistent sharing experience and bypasses the public-share flow the rest of the product is built around.

## What Changes

- Add a mobile recipe-sharing flow that creates a Norish public share link before opening the native share sheet.
- Update the mobile recipe detail actions menu so Share uses the Norish share URL instead of the imported recipe source URL.
- Default the mobile-created share link policy to a non-expiring (`forever`) link for v1, without adding expiry selection UI yet.
- Keep the existing Visit Original action separate so users can still open the source recipe URL when one exists.

## Capabilities

### New Capabilities
- `mobile-recipe-sharing`: Mobile recipe detail sharing creates a Norish public share link and presents it through the platform native share sheet.

### Modified Capabilities
- `recipe-share-react-state`: Shared-react share creation should expose the created share payload so mobile can open the native share sheet with the returned Norish URL.

## Impact

- `apps/mobile` recipe detail actions and share UX
- Existing `@norish/shared-react` recipe-share hooks consumed from mobile
- Public recipe-sharing backend and `/share/<token>` route reused without API shape changes
- Mobile tests covering recipe share action behavior and share-link creation flow
