# Ingredient Parsing Specification

## ADDED Requirements

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

The system SHALL implement unit form selection based on quantity value.

#### Scenario: Select plural when quantity exceeds one

- **WHEN** quantity > 1
- **THEN** use plural form if available, otherwise fall back to base unit

#### Scenario: Select singular for unit quantity

- **WHEN** quantity = 1 or quantity ≤ 1
- **THEN** use singular/base form

#### Scenario: Fallback when plural unavailable

- **WHEN** plural form is not available in parse-ingredient output
- **THEN** use the base unit form

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
