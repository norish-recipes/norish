## Why

The mobile app currently ships with incomplete locale coverage and many UI strings mapped to incorrect i18n keys. This causes untranslated text and inconsistent wording across languages, making the app feel unreliable for non-default locales.

## What Changes

- Audit mobile app user-facing strings and replace hardcoded or incorrect translation key usage with canonical keys from `packages/i18n`.
- Fill missing translations in each supported language for strings used by the mobile app.
- Reuse existing semantically equivalent keys where available; only add new keys when no suitable existing key exists.
- Establish a repeatable validation pass to ensure key references resolve and language bundles remain complete for mobile-used namespaces.

## Capabilities

### New Capabilities

- `mobile-i18n-key-alignment`: Ensure the mobile app consistently references valid, canonical translation keys and has complete language coverage for app-used strings.

### Modified Capabilities

- None.

## Impact

- Affected code: mobile app UI components/screens and translation hook usage in `apps/mobile`, locale resources in `packages/i18n`.
- Affected systems: localization pipeline and language bundle validation used by mobile builds.
- Risk: moderate copy churn across multiple files/locales; mitigated by key reuse-first policy and validation checks.
