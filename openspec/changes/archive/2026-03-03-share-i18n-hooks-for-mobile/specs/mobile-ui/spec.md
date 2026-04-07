## ADDED Requirements

### Requirement: Mobile language selector uses enabled locale configuration

Mobile language selection UI SHALL source locale options from server-enabled locale configuration and SHALL keep the selected locale aligned with available options.

#### Scenario: Selector renders server-enabled locales only

- **WHEN** the mobile language selector is rendered after locale config is loaded
- **THEN** the selector SHALL list only locales included in `enabledLocales`
- **AND** disabled or unknown locale codes SHALL NOT be shown

#### Scenario: Selected locale is no longer enabled

- **WHEN** the current locale is not present in the latest enabled locale list
- **THEN** the UI SHALL switch selection to a deterministic fallback locale
- **AND** the rendered label SHALL match the fallback locale name/code

### Requirement: Mobile language selector labels are translation-aware

Mobile language selection UI SHALL use i18n translations for selector text while still showing locale display names for options.

#### Scenario: Selector chrome is translated

- **WHEN** mobile renders language selector controls in a given locale
- **THEN** selector titles, helper text, and action labels SHALL resolve from translation keys
- **AND** untranslated keys SHALL fall back using existing i18n fallback behavior
