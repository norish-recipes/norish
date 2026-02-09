# site-auth-tokens Specification

## Purpose

TBD - created by archiving change add-site-auth-tokens. Update Purpose after archive.

## Requirements

### Requirement: Site Auth Token Storage

The system SHALL provide a dedicated `site_auth_tokens` database table for storing per-user, per-domain authentication credentials with encrypted values.

#### Scenario: Token table schema

- **WHEN** the database schema is applied
- **THEN** a `site_auth_tokens` table SHALL exist with columns: `id` (uuid PK), `userId` (FK to users), `domain` (text, e.g. "instagram.com"), `name` (text, e.g. "sessionid"), `value` (text, encrypted at rest), `type` (text, "header" or "cookie"), `createdAt`, `updatedAt`
- **AND** the table SHALL have an index on `(userId, domain)` for efficient lookup

#### Scenario: Token value encryption

- **WHEN** a token is stored in the database
- **THEN** the `value` column SHALL be encrypted at rest using the same encryption approach as `server_config.valueEnc`
- **AND** the value SHALL be decrypted only when read for injection into fetch requests

### Requirement: Site Auth Token CRUD API

The system SHALL provide authenticated tRPC procedures for creating, reading, updating, and deleting site auth tokens scoped to the current user.

#### Scenario: Create a token

- **WHEN** an authenticated user calls the `create` procedure with domain, name, value, and type
- **THEN** a new token SHALL be persisted with the user's ID
- **AND** the value SHALL be encrypted before storage
- **AND** the created token SHALL be returned (with value masked)

#### Scenario: List tokens

- **WHEN** an authenticated user calls the `list` procedure
- **THEN** all tokens belonging to that user SHALL be returned
- **AND** token values SHALL be masked in the response (e.g. showing only the first 4 characters)

#### Scenario: Update a token

- **WHEN** an authenticated user calls the `update` procedure with a token ID and new values
- **THEN** the token SHALL be updated only if it belongs to the calling user
- **AND** the updated value SHALL be re-encrypted

#### Scenario: Delete a token

- **WHEN** an authenticated user calls the `delete` procedure with a token ID
- **THEN** the token SHALL be deleted only if it belongs to the calling user

#### Scenario: Unauthorized access

- **WHEN** a user attempts to read, update, or delete a token belonging to another user
- **THEN** the system SHALL reject the request

### Requirement: Site Auth Token Settings UI

The system SHALL provide a settings card in the User settings tab for managing site authentication tokens.

#### Scenario: Empty state

- **WHEN** a user has no site auth tokens configured
- **THEN** the settings card SHALL display an empty state message explaining the feature purpose

#### Scenario: Add a new token

- **WHEN** a user fills in the domain, name, value, and type fields and submits
- **THEN** a new token SHALL be created via the tRPC API
- **AND** the token list SHALL update to show the new entry

#### Scenario: Token list display

- **WHEN** a user has existing tokens
- **THEN** each token SHALL display the domain, name, masked value, and type (header/cookie)
- **AND** each token SHALL have edit and delete actions

#### Scenario: Delete confirmation

- **WHEN** a user clicks delete on a token
- **THEN** a confirmation modal SHALL appear before deletion

#### Scenario: Form validation

- **WHEN** a user submits the token form with missing required fields
- **THEN** validation errors SHALL be displayed for each missing field

### Requirement: Site Auth Token i18n

All user-facing strings in the site auth token feature SHALL be internationalized using next-intl with keys in the `settings.json` namespace.

#### Scenario: Translation coverage

- **WHEN** the site auth token UI is rendered in any supported locale (en, nl, fr, de-formal, de-informal)
- **THEN** all labels, placeholders, descriptions, button text, and error messages SHALL be translated
- **AND** no hardcoded English strings SHALL appear in the UI components

### Requirement: Domain Matching

The system SHALL match stored tokens to request URLs using hostname suffix matching.

#### Scenario: Exact domain match

- **WHEN** a stored token has domain `instagram.com` and a URL `https://instagram.com/p/123` is fetched
- **THEN** the token SHALL be included in the request

#### Scenario: Subdomain match

- **WHEN** a stored token has domain `instagram.com` and a URL `https://www.instagram.com/p/123` is fetched
- **THEN** the token SHALL be included in the request because `www.instagram.com` ends with `instagram.com`

#### Scenario: No match

- **WHEN** a stored token has domain `instagram.com` and a URL `https://youtube.com/watch?v=123` is fetched
- **THEN** the token SHALL NOT be included in the request

#### Scenario: Multiple tokens for same domain

- **WHEN** multiple tokens exist for a matching domain
- **THEN** all matching tokens SHALL be injected into the request

### Requirement: Playwright Token Injection

The system SHALL inject matching site auth tokens into Playwright browser contexts when fetching URLs.

#### Scenario: Header token injection

- **WHEN** a matching token with type `header` exists for the target URL
- **THEN** the token SHALL be added to the `extraHTTPHeaders` object in the Playwright browser context
- **AND** the header name SHALL be the token's `name` field and the value SHALL be the decrypted `value`

#### Scenario: Cookie token injection

- **WHEN** a matching token with type `cookie` exists for the target URL
- **THEN** the token SHALL be added via `context.addCookies()` with the cookie name, value, and domain from the token

#### Scenario: No matching tokens

- **WHEN** no tokens match the target URL domain
- **THEN** the Playwright fetch SHALL proceed with default headers only (existing behavior unchanged)

### Requirement: yt-dlp Token Injection

The system SHALL inject matching site auth tokens into yt-dlp commands when downloading videos.

#### Scenario: Header token injection

- **WHEN** a matching token with type `header` exists for the target URL
- **THEN** the yt-dlp command SHALL include `--add-header "Name: Value"` arguments for each matching header token

#### Scenario: Cookie token injection

- **WHEN** a matching token with type `cookie` exists for the target URL
- **THEN** the system SHALL write a temporary Netscape-format cookie file containing the matching cookies
- **AND** the yt-dlp command SHALL include `--cookies <temp-file-path>`
- **AND** the temporary cookie file SHALL be deleted after yt-dlp completes (in a finally block)

#### Scenario: No matching tokens

- **WHEN** no tokens match the target URL domain
- **THEN** the yt-dlp command SHALL proceed without additional header or cookie arguments (existing behavior unchanged)
