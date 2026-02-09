# unit-configuration Specification

## Purpose

TBD - created by archiving change update-ingredient-parsing. Update Purpose after archive.

## Requirements

### Requirement: German Unit of Measurement Support

The system SHALL include comprehensive German units of measurement in the default configuration.

#### Scenario: German UOMs available for parsing

- **WHEN** parsing ingredients in German locale
- **THEN** all common German units (EL, TL, g, kg, ml, l, etc.) MUST be recognized

#### Scenario: German unit abbreviations recognized

- **WHEN** parsing "2 EL Öl"
- **THEN** "EL" MUST be recognized as "Esslöffel" (tablespoon)

#### Scenario: German unit alternates supported

- **WHEN** parsing "500 gramm Mehl"
- **THEN** "gramm" MUST be recognized as alternate for "g" unit

#### Scenario: German spoon measurements included

- **WHEN** checking available units
- **THEN** "TL" (Teelöffel), "EL" (Esslöffel), and heaping/level variants MUST be present

#### Scenario: German container units included

- **WHEN** checking available units
- **THEN** "Becher", "Dose", "Flasche", "Glas", "Packung" MUST be present

### Requirement: Multi-Language Unit Coexistence

The system SHALL support English, Dutch, and German units simultaneously without conflicts.

#### Scenario: All unit languages loaded together

- **WHEN** the system initializes unit configuration
- **THEN** English, Dutch, and German units MUST all be available in the units map

#### Scenario: Mixed-language unit parsing

- **WHEN** parsing a recipe with "2 cups flour and 500 g sugar"
- **THEN** both English and German units MUST be correctly parsed

#### Scenario: Longest match wins for conflicts

- **WHEN** multiple unit definitions could match (e.g., "el" in Dutch vs German)
- **THEN** the parse-ingredient library MUST use its longest-match-first algorithm

### Requirement: Unit Definition Structure

Each unit definition SHALL include locale-specific short forms, plural forms, and a shared alternates array.

#### Scenario: Unit has locale-specific short forms

- **WHEN** defining a unit in configuration
- **THEN** it MUST include a `short` field as an array of `{ locale: string, name: string }` objects

#### Scenario: Unit has locale-specific plural forms

- **WHEN** defining a unit in configuration
- **THEN** it MUST include a `plural` field as an array of `{ locale: string, name: string }` objects

#### Scenario: Unit has shared alternates array

- **WHEN** defining a unit in configuration
- **THEN** it MUST include an `alternates` array containing all parsing variants across all locales

#### Scenario: At least one locale defined for each form

- **WHEN** validating unit configuration
- **THEN** both `short` and `plural` arrays MUST contain at least one locale entry

#### Scenario: German unit with locale arrays

- **WHEN** defining "gram" unit with German support
- **THEN** it MUST have structure:
  ```json
  {
    "short": [
      { "locale": "en", "name": "g" },
      { "locale": "de", "name": "g" }
    ],
    "plural": [
      { "locale": "en", "name": "grams" },
      { "locale": "de", "name": "g" }
    ],
    "alternates": ["g", "gram", "grams", "gramm"]
  }
  ```

### Requirement: Default Units Configuration File

The system SHALL maintain a JSON file with all default unit definitions.

#### Scenario: Units file is valid JSON

- **WHEN** loading `config/units.default.json`
- **THEN** it MUST be valid JSON that parses without errors

#### Scenario: Units conform to UnitsMap schema

- **WHEN** validating `units.default.json`
- **THEN** it MUST pass validation against `UnitsMapSchema` (Zod schema)

#### Scenario: No duplicate unit keys

- **WHEN** adding new units to the configuration
- **THEN** unit keys MUST be unique across all languages

### Requirement: Unit Configuration Database Storage

The system SHALL allow administrators to customize units via database configuration.

#### Scenario: Load units from database if present

- **WHEN** the system retrieves unit configuration
- **THEN** it MUST check database first, then fall back to `units.default.json`

#### Scenario: Database units override defaults

- **WHEN** a database unit has the same key as a default unit
- **THEN** the database version MUST take precedence

### Requirement: Locale-Specific Display Forms

The system SHALL support any locale string for unit display customization.

#### Scenario: Support arbitrary locale codes

- **WHEN** administrators add custom units
- **THEN** the system MUST accept any valid locale string (en, de, nl, fr, es, ja, etc.)

#### Scenario: Multiple locales per unit

- **WHEN** defining a unit
- **THEN** administrators MAY provide display forms for any number of locales

#### Scenario: Different forms for same locale

- **WHEN** defining short and plural forms for the same locale
- **THEN** they MAY be identical (e.g., German "g" for both) or different (e.g., English "g" vs "grams")

### Requirement: Configuration Validation Schema

The system SHALL validate unit configuration against a Zod schema supporting locale arrays.

#### Scenario: Validate LocalizedName objects

- **WHEN** validating unit configuration
- **THEN** each entry in short/plural arrays MUST have both `locale` and `name` as non-empty strings

#### Scenario: Reject invalid locale arrays

- **WHEN** unit configuration has empty locale arrays
- **THEN** validation MUST fail with clear error message

#### Scenario: Reject missing required fields

- **WHEN** unit configuration is missing `short`, `plural`, or `alternates`
- **THEN** validation MUST fail indicating which field is missing

### Requirement: Configuration Customization Tracking

The system SHALL track whether administrators have customized the default unit configuration.

#### Scenario: Mark configuration as overwritten on admin save

- **WHEN** an administrator saves custom unit configuration
- **THEN** the system MUST set `isOverwritten = true` in database

#### Scenario: Preserve custom config on updates

- **WHEN** deploying a new version with updated default units
- **AND** `isOverwritten = true`
- **THEN** the system MUST NOT overwrite the custom configuration

#### Scenario: Update non-customized config

- **WHEN** deploying a new version with updated default units
- **AND** `isOverwritten = false` or not set
- **THEN** the system MUST update to new default configuration

#### Scenario: Hash-based change detection

- **WHEN** application starts
- **THEN** the system MUST compare hash of default units file against stored hash to detect changes

### Requirement: Breaking Change Documentation

The system SHALL document breaking changes to unit configuration format.

#### Scenario: Patch notes warn about config reset

- **WHEN** releasing version with new locale-aware format
- **THEN** patch notes MUST warn that custom UOM configurations will be reset

#### Scenario: Provide backup instructions

- **WHEN** documenting the upgrade
- **THEN** instructions MUST tell admins to backup custom units before upgrading

#### Scenario: Provide re-customization steps

- **WHEN** documenting the upgrade
- **THEN** instructions MUST explain how to re-apply customizations in new format
