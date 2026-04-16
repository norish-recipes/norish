## ADDED Requirements

### Requirement: Mobile UI uses canonical translation keys

The mobile application SHALL reference only valid canonical translation keys defined in `packages/i18n` for all user-visible strings.

#### Scenario: Replace incorrect key references

- **WHEN** a mobile screen uses a translation key that does not exist or does not match the intended message
- **THEN** the implementation MUST replace it with an existing canonical key that matches the same semantic meaning and context

#### Scenario: Prevent unresolved key usage

- **WHEN** mobile code is updated with translation key references
- **THEN** each referenced key MUST resolve to a defined entry in `packages/i18n`

### Requirement: Equivalent existing keys are reused before new keys are added

The translation workflow MUST check for semantically equivalent existing keys before introducing new translation keys for mobile strings.

#### Scenario: Similar key already exists

- **WHEN** a needed mobile string is already represented by an existing key with equivalent meaning and usage context
- **THEN** the mobile code MUST use the existing key and MUST NOT add a duplicate key

#### Scenario: No equivalent key exists

- **WHEN** no existing key accurately represents the required mobile string
- **THEN** a new key MAY be added with translations provided for all supported locales

### Requirement: Mobile-used keys are complete across supported locales

For every translation key used by the mobile app, `packages/i18n` SHALL include non-empty translation values for each supported language.

#### Scenario: Missing locale entry detected

- **WHEN** a key used by mobile lacks a translation value in any supported locale
- **THEN** the missing locale value MUST be added before the change is considered complete

#### Scenario: Validation of locale completeness

- **WHEN** translation validation is run for mobile-used namespaces
- **THEN** the check MUST fail if any mobile-used key is missing in any supported locale
