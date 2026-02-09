# Unit Configuration Specification

## ADDED Requirements

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

Each unit definition SHALL include short form, plural form, and alternates array.

#### Scenario: Unit has short form

- **WHEN** defining a unit in `units.default.json`
- **THEN** it MUST include a `short` field

#### Scenario: Unit has plural form

- **WHEN** defining a unit in `units.default.json`
- **THEN** it MUST include a `plural` field

#### Scenario: Unit has alternates array

- **WHEN** defining a unit in `units.default.json`
- **THEN** it MUST include an `alternates` array (may be empty)

#### Scenario: German unit follows standard structure

- **WHEN** adding a German unit like "EL"
- **THEN** it MUST have structure: `{"short": "el", "plural": "EL", "alternates": ["el.", "esslöffel", "essl.", "essl"]}`

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
