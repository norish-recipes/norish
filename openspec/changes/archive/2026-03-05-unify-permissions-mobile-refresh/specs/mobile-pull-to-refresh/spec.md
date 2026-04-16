## ADDED Requirements

### Requirement: Mobile list/feed surfaces support pull-to-refresh

Primary Norish mobile list/feed surfaces SHALL support pull-to-refresh to manually revalidate visible data.

#### Scenario: User performs pull-to-refresh gesture

- **WHEN** the user performs a pull-down refresh gesture on an in-scope mobile list/feed screen
- **THEN** the screen SHALL trigger data refetch for its bound queries
- **AND** refreshed content SHALL replace stale data after the request completes

#### Scenario: Refresh feedback is visible during active refresh

- **WHEN** a pull-to-refresh request is in progress
- **THEN** the UI SHALL show an active refreshing indicator
- **AND** repeated pull gestures SHALL NOT start overlapping refresh requests

#### Scenario: Refresh failure handling

- **WHEN** pull-to-refresh refetch fails
- **THEN** the screen SHALL stop the refreshing indicator
- **AND** previously loaded content SHALL remain visible with existing error handling behavior
