## ADDED Requirements

### Requirement: Mobile loads translations from shared i18n package

The mobile application SHALL load locale messages from `@norish/i18n` using valid locale codes defined by shared i18n configuration.

#### Scenario: Valid locale messages are loaded

- **WHEN** mobile initializes or switches to a locale that passes shared locale validation
- **THEN** the app SHALL load translation messages for that locale from `@norish/i18n`
- **AND** translation lookups SHALL resolve from the loaded messages during rendering

#### Scenario: Invalid locale falls back to default locale

- **WHEN** mobile receives or computes a locale code that is not valid per shared i18n config
- **THEN** mobile SHALL fall back to the configured default locale
- **AND** the app SHALL load messages for the fallback locale

### Requirement: Mobile locale choices are constrained by server-enabled locales

The mobile application SHALL derive selectable locale options from the `config.localeConfig` tRPC response and SHALL NOT expose disabled locales as selectable options.

#### Scenario: Enabled locales drive selector options

- **WHEN** `config.localeConfig` returns enabled locale entries
- **THEN** mobile SHALL present only those locale codes as selectable language options
- **AND** each option SHALL include the server-provided locale display name when available

#### Scenario: No enabled locales returned

- **WHEN** `config.localeConfig` returns no enabled locales
- **THEN** mobile SHALL provide a safe fallback option using the default locale
- **AND** locale switching UI SHALL remain functional without crashing
