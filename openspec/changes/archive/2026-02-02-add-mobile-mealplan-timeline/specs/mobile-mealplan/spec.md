# mobile-mealplan Specification Delta

## ADDED Requirements

### Requirement: Mobile Timeline View

The mobile meal plan SHALL display a vertically scrolling timeline of days with planned items grouped by meal slot.

#### Scenario: Timeline displays days with slots

- **WHEN** the user views the mobile meal plan
- **THEN** each visible day SHALL display sections for Breakfast, Lunch, Dinner, and Snack slots
- **AND** planned items SHALL be grouped under their respective slots

#### Scenario: Slot displays multiple items

- **WHEN** a slot contains multiple planned items
- **THEN** all items SHALL be displayed within that slot section
- **AND** items SHALL be ordered by their `sortOrder` value

### Requirement: Planned Item Display

Each planned item SHALL display its title, meal slot, calorie count, and servings information.

#### Scenario: Recipe item display

- **WHEN** a planned item is of type `recipe`
- **THEN** the item SHALL display the recipe name as title
- **AND** the item SHALL display a thumbnail image if available
- **AND** the subtitle SHALL show slot name, kcal, and servings (e.g., "Dinner - 450 kcal - 4 servings")

#### Scenario: Note item display

- **WHEN** a planned item is of type `note`
- **THEN** the item SHALL display the note title in italic styling
- **AND** no thumbnail image SHALL be shown
- **AND** the subtitle SHALL show the slot name

#### Scenario: Recipe navigation

- **WHEN** the user taps on a recipe item
- **THEN** the user SHALL be navigated to the recipe detail page

### Requirement: Virtualized Infinite Scroll

The timeline SHALL use virtualization to efficiently render large date ranges with bidirectional infinite scrolling.

#### Scenario: Initial load range

- **WHEN** the timeline first loads
- **THEN** the system SHALL load the previous week (7 days) plus the next month (30 days)
- **AND** only visible days SHALL be rendered to the DOM

#### Scenario: Scroll down loads future

- **WHEN** the user scrolls down past the loaded range
- **THEN** the system SHALL load additional future days
- **AND** the scroll position SHALL be preserved

#### Scenario: Scroll up loads past

- **WHEN** the user scrolls up past the loaded range
- **THEN** the system SHALL load additional past days
- **AND** the scroll position SHALL be preserved

### Requirement: Today Focus

The timeline SHALL focus on the current day by default and provide navigation to return to today.

#### Scenario: Initial scroll position

- **WHEN** the timeline first loads
- **THEN** the current day SHALL be scrolled into view

#### Scenario: Scroll-to-today button visibility

- **WHEN** the current day is not visible in the viewport
- **THEN** a floating button SHALL appear to navigate to today

#### Scenario: Scroll-to-today button direction

- **WHEN** the scroll-to-today button is visible
- **THEN** the button SHALL display a chevron pointing up if today is above the viewport
- **AND** the button SHALL display a chevron pointing down if today is below the viewport

#### Scenario: Scroll-to-today action

- **WHEN** the user taps the scroll-to-today button
- **THEN** the timeline SHALL smoothly scroll to center the current day in view

### Requirement: Drag-and-Drop Item Movement

Users SHALL be able to move planned items between days and slots via drag-and-drop.

#### Scenario: Initiate drag

- **WHEN** the user performs a long press on a planned item
- **THEN** the item SHALL become draggable
- **AND** no dedicated drag handle SHALL be required

#### Scenario: Visual feedback during drag

- **WHEN** an item is being dragged
- **THEN** a drag overlay SHALL display a preview of the item
- **AND** valid drop targets SHALL be visually indicated

#### Scenario: Drop on different day/slot

- **WHEN** the user drops an item on a different day or slot
- **THEN** the item SHALL be moved to the target location
- **AND** the move SHALL be persisted via the `moveItem` mutation

#### Scenario: Optimistic update

- **WHEN** a drag-and-drop move is initiated
- **THEN** the UI SHALL update optimistically before server confirmation
- **AND** the UI SHALL rollback if the server rejects the move

### Requirement: Loading State

The timeline SHALL display a skeleton loading state while data is being fetched.

#### Scenario: Initial loading

- **WHEN** the timeline is loading data
- **THEN** a skeleton placeholder SHALL be displayed
- **AND** the skeleton SHALL match the timeline structure with day and item placeholders

### Requirement: Internationalization

All timeline UI text SHALL support the application's 5 configured locales.

#### Scenario: Translated slot labels

- **WHEN** the user views the timeline in any supported locale (en, nl, fr, de-formal, de-informal)
- **THEN** slot labels (Breakfast, Lunch, Dinner, Snack) SHALL be displayed in the user's language

#### Scenario: Translated timeline labels

- **WHEN** the user views the timeline
- **THEN** all UI labels including date formats, empty states, and button labels SHALL be localized
