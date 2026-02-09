# Unit Localization

## MODIFIED Requirements

### Requirement: The getLocalizedUnit function MUST be exported for external use

The `lib/unit-localization.ts` module MUST export the `getLocalizedUnit` function so that external consumers can import and use it for unit localization.

**Rationale:** Unit localization tests require access to this function to verify localization behavior

**Priority:** P1 - High impact

#### Scenario: getLocalizedUnit can be imported from lib/unit-localization module

**Given** the `lib/unit-localization.ts` module  
**When** a consumer imports `getLocalizedUnit`  
**Then** the function must be successfully imported  
**And** it must be callable with (unitKey, locale) parameters  
**And** it must return the localized unit name for the given locale

#### Scenario: getLocalizedUnit returns correct German translations

**Given** a unit with German locale entries (e.g., "tablespoon")  
**When** `getLocalizedUnit("tablespoon", "de")` is called  
**Then** it must return "EL" (German short form)  
**And** the plural form must return "Esslöffel"

#### Scenario: getLocalizedUnit falls back gracefully for missing locales

**Given** a unit without French locale entries  
**When** `getLocalizedUnit("tablespoon", "fr")` is called  
**Then** it must fall back to English ("tbsp")  
**And** no error should be thrown
