# ingredient-parsing Specification

## Purpose

TBD - created by archiving change update-ingredient-parsing. Update Purpose after archive.

## Requirements

### Requirement: Parse-Ingredient v2 Integration

The system SHALL use parse-ingredient version 2.0.1 or higher for all ingredient parsing operations.

#### Scenario: Package version verification

- **WHEN** the application starts
- **THEN** parse-ingredient v2.0.1 or higher MUST be installed and available

#### Scenario: Use v2 field names

- **WHEN** parsing an ingredient
- **THEN** the system MUST use v2 field names (not v1 legacy names like unitOfMeasureID)

### Requirement: Grammatically Correct Unit Forms

The system SHALL store units in grammatically correct forms based on quantity at parse time.

#### Scenario: Plural form for quantity greater than 1

- **WHEN** parsing an ingredient with quantity > 1 (e.g., "450 grams flour")
- **THEN** the system MUST store the plural form of the unit if available

#### Scenario: Singular form for quantity equal to 1

- **WHEN** parsing an ingredient with quantity = 1 (e.g., "1 gram salt")
- **THEN** the system MUST store the singular form of the unit

#### Scenario: Singular form for null or missing quantity

- **WHEN** parsing an ingredient without a quantity (e.g., "salt to taste")
- **THEN** the system MUST default to singular form of the unit

#### Scenario: Plural form for fractional quantities greater than 1

- **WHEN** parsing an ingredient with fractional quantity > 1 (e.g., "1.5 cups milk")
- **THEN** the system MUST use the plural form

#### Scenario: Singular form for fractional quantities less than or equal to 1

- **WHEN** parsing an ingredient with fractional quantity ≤ 1 (e.g., "0.5 cup milk")
- **THEN** the system MUST use the singular form

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

### Requirement: Display Uses Stored Value

The system SHALL display ingredient units exactly as stored without re-parsing.

#### Scenario: Direct display of stored unit

- **WHEN** rendering an ingredient in the recipe view
- **THEN** the system MUST display the `unit` field value directly without re-parsing

#### Scenario: No computation on display

- **WHEN** displaying a list of ingredients
- **THEN** no parsing or unit form computation SHALL occur

### Requirement: Backward Compatibility with Stored Data

The system SHALL maintain backward compatibility with ingredients stored before this change.

#### Scenario: Display existing ingredients without error

- **WHEN** retrieving an ingredient stored with old unit format
- **THEN** the system MUST display it correctly without errors

#### Scenario: No automatic migration of existing data

- **WHEN** the system upgrades to v2 parsing
- **THEN** existing stored ingredients MUST NOT be automatically modified

### Requirement: Multi-Language Unit Support

The system SHALL support parsing ingredients in multiple languages including English, Dutch, and German.

#### Scenario: Parse German ingredients

- **WHEN** parsing an ingredient string with German units (e.g., "500 g Mehl")
- **THEN** the system MUST correctly identify and parse German units

#### Scenario: Parse Dutch ingredients

- **WHEN** parsing an ingredient string with Dutch units (e.g., "2 eetlepels olie")
- **THEN** the system MUST correctly identify and parse Dutch units

#### Scenario: Parse mixed-language recipes

- **WHEN** a recipe contains both German and English units
- **THEN** the system MUST correctly parse all units regardless of language mixing

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
