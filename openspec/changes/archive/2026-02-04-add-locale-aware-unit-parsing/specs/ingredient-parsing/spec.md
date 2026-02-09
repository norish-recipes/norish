# ingredient-parsing Spec Delta

## MODIFIED Requirements

### Requirement: Unit Form Selection Logic

The system SHALL select short or plural form based on quantity and user locale.

#### Scenario: Plural form for quantity greater than 1

- **WHEN** displaying an ingredient with quantity > 1
- **THEN** the system MUST use the plural form for the user's locale

#### Scenario: Short form for quantity equal to 1 or less

- **WHEN** displaying an ingredient with quantity ≤ 1
- **THEN** the system MUST use the short form for the user's locale

#### Scenario: Short form for null or missing quantity

- **WHEN** displaying an ingredient without a quantity
- **THEN** the system MUST use the short form for the user's locale

#### Scenario: Fallback to English for unknown locale

- **WHEN** a user's locale is not found in the unit configuration
- **THEN** the system MUST fall back to English ("en") locale display

#### Scenario: Fallback to first available locale

- **WHEN** neither user's locale nor English is available in unit configuration
- **THEN** the system MUST display the first available locale's form

#### Scenario: Fallback to unit ID for unknown units

- **WHEN** displaying an ingredient with a unit not found in configuration
- **THEN** the system MUST display the unit ID as-is (e.g., "gram")

## ADDED Requirements

### Requirement: Locale-Specific Unit Display

The system SHALL display ingredient units using locale-specific forms based on the user's locale.

#### Scenario: German user sees German unit display

- **WHEN** a German user (locale: "de") views an ingredient with unit "gram"
- **THEN** the system MUST display "g" according to German locale configuration

#### Scenario: English user sees English unit display

- **WHEN** an English user (locale: "en") views an ingredient with unit "gram"
- **THEN** the system MUST display "grams" (plural) or "gram" (singular) according to English locale configuration

#### Scenario: Dutch user sees Dutch unit display

- **WHEN** a Dutch user (locale: "nl") views an ingredient with unit "tablespoon"
- **THEN** the system MUST display "eetlepels" according to Dutch locale configuration

### Requirement: Unit Flattening for Parse Library

The system SHALL flatten locale-aware unit configuration for the parse-ingredient library.

#### Scenario: Flatten locale arrays to single forms

- **WHEN** preparing unit configuration for parse-ingredient library
- **THEN** the system MUST extract first locale's short and plural forms into flat structure

#### Scenario: Preserve alternates array unchanged

- **WHEN** flattening unit configuration
- **THEN** the alternates array MUST be passed through unchanged

#### Scenario: Flattening maintains all unit IDs

- **WHEN** flattening configuration with multiple units
- **THEN** all unit IDs (keys) MUST be preserved in the flattened output

## REMOVED Requirements

### ~~Requirement: Display Uses Stored Value~~

~~The system SHALL display ingredient units exactly as stored without re-parsing.~~

**Reason:** Replaced with locale-specific formatting requirement above. Units are now formatted at display time based on user locale instead of displaying stored canonical IDs directly.
