## ADDED Requirements

### Requirement: Mobile startup requires backend URL setup when missing

The mobile app SHALL check for a persisted backend base URL at startup and SHALL route users to a connection setup screen when no URL is present.

#### Scenario: First launch with no saved URL

- **WHEN** the app starts and no backend base URL exists in secure storage
- **THEN** the app SHALL show the backend connection setup screen before app tabs

#### Scenario: Launch with saved URL

- **WHEN** the app starts and a backend base URL exists in secure storage
- **THEN** the app SHALL skip the connection setup screen and route directly into app tabs

---

### Requirement: Connection setup validates backend health before saving

The connection setup flow SHALL verify backend reachability using `GET /api/health` and SHALL only save the base URL on successful health response.

#### Scenario: Successful health check

- **WHEN** the user enters a valid base URL and taps connect
- **THEN** the app SHALL call `<baseUrl>/api/health`
- **AND** on success, persist the normalized base URL in secure storage
- **AND** navigate into app tabs

#### Scenario: Failed health check

- **WHEN** the health request fails or returns non-success
- **THEN** the app SHALL show an error state
- **AND** SHALL NOT persist the entered URL

---

### Requirement: Base URL utility exposes tRPC endpoint derivation

The mobile app SHALL provide a reusable helper that derives the tRPC endpoint URL as `<baseUrl>/api/trpc` from the persisted base URL.

#### Scenario: Build tRPC endpoint from saved URL

- **WHEN** code requests the tRPC HTTP endpoint for backend calls
- **THEN** the app SHALL return the URL using the persisted base URL plus `/api/trpc`
