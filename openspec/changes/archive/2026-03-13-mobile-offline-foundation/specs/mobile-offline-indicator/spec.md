## ADDED Requirements

### Requirement: Reachability banner differentiates offline and backend-unreachable states

The mobile app SHALL display a visible shell-level banner when `useNetworkStatus()` reports a settled non-online mode, with distinct messaging for `offline` and `backend-unreachable`.

#### Scenario: Device goes offline

- **WHEN** `useNetworkStatus()` returns `mode: 'offline'`
- **THEN** a banner SHALL appear at the top of the screen with text indicating the user is offline and viewing cached data

#### Scenario: Backend is unreachable while device remains online

- **WHEN** `useNetworkStatus()` returns `mode: 'backend-unreachable'`
- **THEN** a banner SHALL appear at the top of the screen with text indicating the Norish backend cannot be reached and cached data is being shown

#### Scenario: App returns online

- **WHEN** `useNetworkStatus()` returns `mode: 'online'`
- **THEN** the reachability banner SHALL be hidden

---

### Requirement: Offline banner is rendered at the shell level

The `OfflineBanner` component SHALL be rendered in the root layout (inside `AuthGatedProviders`) so it appears consistently across all tabs without per-screen duplication.

#### Scenario: Banner visible on all tabs while offline

- **WHEN** the app is in a settled non-online mode
- **AND** the user navigates between dashboard, groceries, calendar, and profile tabs
- **THEN** the offline banner SHALL remain visible on each tab

---

### Requirement: Reachability banner text is internationalized

The reachability banner text SHALL use the app's i18n system so it displays in the user's configured locale for both `offline` and `backend-unreachable` states.

#### Scenario: User has non-English locale

- **WHEN** the app is in a settled non-online reachability mode
- **AND** the user's locale is set to a supported non-English language
- **THEN** the banner text SHALL be displayed in the user's configured language

---

### Requirement: Hidden bootstrap runtime state is not shown as a fourth banner mode

The mobile app SHALL NOT surface the internal bootstrap runtime state as a user-visible reachability banner.

#### Scenario: Bootstrap is still initializing

- **WHEN** cache restore and/or the first reachability determination is still in progress
- **THEN** no `offline` or `backend-unreachable` banner SHALL be shown solely because bootstrap has not settled yet

---

### Requirement: Offline banner uses a non-intrusive design

The reachability banner SHALL be compact (single line), use a muted warning color scheme, and SHALL NOT block interaction with underlying content.

#### Scenario: User can interact with content below banner

- **WHEN** the offline banner is visible
- **THEN** the user SHALL be able to scroll, tap, and navigate all visible content below the banner without obstruction
