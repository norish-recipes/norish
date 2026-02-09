## ADDED Requirements

### Requirement: Calendar Skeleton Loading States

The calendar page SHALL display skeleton loaders that match the layout structure while data is loading.

#### Scenario: Initial page load

- **WHEN** the calendar page is accessed
- **THEN** a skeleton matching the current viewport (desktop week grid or mobile day list) SHALL be displayed until data loads

#### Scenario: Desktop navigation to unloaded week

- **WHEN** user navigates to a week outside the currently loaded date range
- **THEN** a loading indicator or skeleton overlay SHALL appear for that week until data is fetched

#### Scenario: Mobile scroll to unloaded dates

- **WHEN** user scrolls to dates outside the currently loaded range
- **THEN** skeleton day cards SHALL appear at the scroll boundary until data loads

### Requirement: Desktop On-Demand Week Loading

The desktop calendar SHALL fetch week data on-demand when navigating beyond the initially loaded range.

#### Scenario: Navigate to future week

- **WHEN** user clicks "next week" and the target week is not yet loaded
- **THEN** the system SHALL fetch data for the target week
- **AND** display loading state during fetch
- **AND** render the week content once data arrives

#### Scenario: Navigate to past week

- **WHEN** user clicks "previous week" and the target week is not yet loaded
- **THEN** the system SHALL fetch data for the target week
- **AND** display loading state during fetch
- **AND** render the week content once data arrives

#### Scenario: Navigate within loaded range

- **WHEN** user navigates to a week already in the loaded date range
- **THEN** the week SHALL render immediately without additional fetch

### Requirement: Mobile Windowed Date Loading

The mobile calendar SHALL initially load a limited date window and expand it on-demand as the user scrolls.

#### Scenario: Initial mobile load

- **WHEN** the mobile calendar page loads
- **THEN** data for 2 weeks before and 2 weeks after the current date SHALL be fetched
- **AND** days outside this range SHALL NOT be fetched initially

#### Scenario: Scroll toward past dates

- **WHEN** user scrolls upward and approaches the earliest loaded date
- **THEN** additional past weeks SHALL be fetched
- **AND** skeleton cards SHALL appear while loading
- **AND** scroll position SHALL be preserved when new content loads

#### Scenario: Scroll toward future dates

- **WHEN** user scrolls downward and approaches the latest loaded date
- **THEN** additional future weeks SHALL be fetched
- **AND** skeleton cards SHALL appear while loading
