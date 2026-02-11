# Implementation Tasks

## 1. Database & Schema

- [ ] 1.1 Add `ThemeConfig` schema to `server/db/zodSchemas/server-config.ts`
- [ ] 1.2 Add `THEME_CONFIG` to `ServerConfigKeys` enum
- [ ] 1.3 Add Zod validator for theme URL and metadata

## 2. Admin UI

- [ ] 2.1 Create `ThemeConfigCard` component in `app/(app)/settings/admin/components/`
- [ ] 2.2 Add theme URL input field with validation
- [ ] 2.3 Add test/preview button to verify CSS loads
- [ ] 2.4 Add theme card to admin settings layout

## 3. Server & API

- [ ] 3.1 Create tRPC mutation to update theme config
- [ ] 3.2 Add theme config retrieval to admin config query

## 4. Client-side Loading

- [ ] 4.1 Create CSS injection utility in `lib/` for loading external CSS
- [ ] 4.2 Add CSS loading logic to app providers/layout
- [ ] 4.3 Handle fallback if CSS fails to load

## 5. Documentation & Examples

- [ ] 5.1 Create example theme CSS file with light/dark mode variables
- [ ] 5.2 Add theme creation guide (optional: in docs or README)

## 6. Testing

- [ ] 6.1 Test external CSS loading with valid URL
- [ ] 6.2 Test fallback with invalid/unreachable URL
- [ ] 6.3 Verify light/dark mode switching works with custom theme

## 7. Security & Polish

- [ ] 7.1 Add CSP headers for external CSS if needed
- [ ] 7.2 Add URL validation (HTTPS, domain whitelist optional)
- [ ] 7.3 Add loading state and error handling in UI
