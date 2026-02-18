## ADDED Requirements

### Requirement: Locale stored in user preferences

The system SHALL store the authenticated user's preferred locale in the JSONB `preferences` column as `preferences.locale` instead of a dedicated `locale` column on the user table.

#### Scenario: Locale persisted through preferences API

- **WHEN** an authenticated user sets their locale via `updatePreferences({ locale: "de-informal" })`
- **THEN** the value is stored in `preferences.locale` in the database
- **AND** subsequent reads of the user's preferences return `{ locale: "de-informal", ... }`

#### Scenario: Locale defaults to null when unset

- **WHEN** a user has never set a locale preference
- **THEN** `preferences.locale` is `undefined`
- **AND** the system falls back to the server default locale

### Requirement: Language selector in user settings

The user settings PreferencesCard SHALL include a language dropdown that allows the user to select their preferred language from the list of enabled locales.

#### Scenario: Language dropdown displays current locale

- **WHEN** an authenticated user views the PreferencesCard on the settings page
- **THEN** a language dropdown is displayed showing the user's current locale as the selected value
- **AND** the dropdown lists all server-enabled locales with their display names

#### Scenario: Changing language from settings

- **WHEN** the user selects a different language from the settings dropdown
- **THEN** `updatePreferences({ locale: selectedLocale })` is called
- **AND** the page language updates to the new locale
- **AND** the navbar user menu language switch reflects the new selection

### Requirement: User menu and settings locale sync

The navbar user menu language switch and the settings page language dropdown SHALL read and write the same `preferences.locale` value, ensuring consistent behavior regardless of which UI surface the user interacts with.

#### Scenario: Language changed from user menu reflects in settings

- **WHEN** the user changes their language using the navbar user menu language switch
- **THEN** the settings page language dropdown shows the updated locale without requiring a page refresh

#### Scenario: Language changed from settings reflects in user menu

- **WHEN** the user changes their language using the settings page dropdown
- **THEN** the navbar user menu language switch shows the updated locale

### Requirement: Cross-device locale sync

The system SHALL persist the locale preference in the database so that language selection syncs across all devices where the user is authenticated.

#### Scenario: Locale set on one device appears on another

- **WHEN** the user sets their locale to "fr" on device A
- **AND** the user opens the application on device B
- **THEN** device B resolves the user's locale as "fr"

## REMOVED Requirements

### Requirement: Dedicated locale column

**Reason**: The dedicated `locale` text column on the `user` table is replaced by `preferences.locale` in the JSONB `preferences` column. This consolidates all user preferences into a single extensible structure.
**Migration**: A database migration copies existing `locale` values into `preferences.locale` before dropping the column. The `getLocale`/`setLocale` tRPC procedures and `getUserLocale`/`updateUserLocale` repository functions are removed.
