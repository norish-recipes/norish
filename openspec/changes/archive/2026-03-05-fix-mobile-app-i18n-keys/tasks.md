## 1. Translation Key Audit and Mapping

- [x] 1.1 Inventory all user-visible translation calls and string keys used in `apps/mobile`.
- [x] 1.2 For each mobile string, find an equivalent canonical key in `packages/i18n` or mark it as requiring a new key.
- [x] 1.3 Produce a key-mapping checklist that records old key usage, selected canonical key, and justification for any new key.

## 2. Mobile Key Alignment

- [x] 2.1 Update mobile screens/components/hooks to use mapped canonical keys from the audit.
- [x] 2.2 Remove or replace unresolved/incorrect key references so every mobile key resolves in `packages/i18n`.
- [x] 2.3 Run type/lint checks for the mobile app and fix issues caused by key reference changes.

## 3. Locale Completeness in `packages/i18n`

- [x] 3.1 Add missing translation entries for every mobile-used key across all supported languages.
- [x] 3.2 Ensure any newly introduced keys include non-empty values in every supported locale file.
- [x] 3.3 Verify no duplicate near-equivalent keys were added when an existing key could be reused.

## 4. Validation and Regression Safety

- [x] 4.1 Run existing translation validation (or add one if missing) to fail on unresolved keys and missing locale entries.
- [x] 4.2 Execute mobile app tests/build checks relevant to i18n rendering and fix regressions.
- [x] 4.3 Perform spot QA in multiple locales on key mobile flows to confirm correct wording and no fallback text.
