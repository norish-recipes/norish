## ADDED Requirements

### Requirement: Desktop Grid Layout

The desktop meal plan SHALL display days in a responsive grid layout that adapts to screen size.

#### Scenario: Grid displays 3 columns on large screens

- **WHEN** the user views the calendar on a large viewport (≥1024px)
- **THEN** the timeline SHALL render as a 3-column grid
- **AND** days SHALL flow left-to-right, top-to-bottom in chronological order

#### Scenario: Grid displays 2 columns on medium screens

- **WHEN** the user views the calendar on a medium viewport (≥768px and <1024px)
- **THEN** the timeline SHALL render as a 2-column grid
- **AND** days SHALL flow left-to-right, top-to-bottom in chronological order

#### Scenario: Mobile view on small screens

- **WHEN** the user views the calendar on a mobile viewport (<768px)
- **THEN** the existing mobile timeline view SHALL be rendered instead

### Requirement: Fixed Height Scrollable Cards

Each day card in the desktop view SHALL have a fixed height with scrollable content.

#### Scenario: Card height remains consistent

- **WHEN** multiple day cards are displayed in the grid
- **THEN** all cards SHALL have the same fixed height regardless of content

#### Scenario: Overflow content is scrollable

- **WHEN** a day has more planned items than fit in the fixed height
- **THEN** the card content SHALL be scrollable vertically
- **AND** the scroll SHALL be contained within the card

#### Scenario: Cards with few items

- **WHEN** a day has few or no planned items
- **THEN** the card SHALL maintain the same fixed height as other cards
- **AND** empty space SHALL remain within the card

### Requirement: Desktop Drag-and-Drop

Users SHALL be able to move planned items between days via drag-and-drop on desktop.

#### Scenario: Drag item to different day

- **WHEN** the user drags a planned item to a different day card
- **THEN** the item SHALL be moved to the target day
- **AND** the item SHALL retain its original meal slot

#### Scenario: Visual feedback during drag

- **WHEN** an item is being dragged over a valid drop target
- **THEN** the target card SHALL display a visual highlight

### Requirement: Desktop Infinite Scroll

The desktop timeline SHALL support bidirectional infinite scrolling to load additional days.

#### Scenario: Scroll loads more days

- **WHEN** the user scrolls near the edge of the loaded date range
- **THEN** the system SHALL load additional days in that direction
- **AND** existing content SHALL remain in place
