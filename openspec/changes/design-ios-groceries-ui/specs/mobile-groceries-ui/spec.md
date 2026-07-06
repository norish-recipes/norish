## ADDED Requirements

### Requirement: Mobile groceries screen provides two organization modes
The mobile groceries UI SHALL replace the placeholder groceries tab with an iOS-first grocery experience that supports viewing groceries grouped by store and grouped by recipe.

#### Scenario: Default grocery screen renders structured content
- **WHEN** a user opens the groceries tab on iOS
- **THEN** the screen SHALL render grocery content instead of the placeholder tab body
- **AND** the screen SHALL expose a visible control for switching between store and recipe organization modes

#### Scenario: User switches grouping mode
- **WHEN** the user changes the grouping control from store to recipe, or from recipe to store
- **THEN** the groceries content SHALL update to the selected organization mode
- **AND** the selected mode SHALL remain visually clear in the screen chrome

### Requirement: Store mode mirrors core web grocery grouping
Store mode SHALL organize groceries into an unsorted section plus ordered store sections so the mobile information architecture matches the web grocery model.

#### Scenario: Groceries without a store assignment are shown separately
- **WHEN** grocery data includes items without a store assignment
- **THEN** the screen SHALL render those items in a dedicated unsorted section
- **AND** store-assigned items SHALL NOT appear in that unsorted section

#### Scenario: Store sections show grouped grocery rows
- **WHEN** grocery data includes one or more stores
- **THEN** the screen SHALL render a separate section for each store group
- **AND** each section SHALL present only the grocery rows assigned to that store

### Requirement: Recipe mode mirrors core web grocery grouping
Recipe mode SHALL organize groceries by source recipe so users can understand which meal plan or recipe contributed each grocery item.

#### Scenario: Recipe sections render contributing groceries
- **WHEN** the selected mode is recipe and grocery data includes recipe associations
- **THEN** the screen SHALL render sections keyed by recipe
- **AND** each section SHALL present the groceries associated with that recipe

#### Scenario: Non-recipe groceries remain visible in recipe mode
- **WHEN** the selected mode is recipe and some groceries do not belong to a recipe
- **THEN** the screen SHALL render those groceries in a separate non-recipe section
- **AND** those groceries SHALL remain actionable in the same list surface

### Requirement: Grocery interactions feel native on iOS
The mobile groceries UI SHALL use mobile-native spacing, touch targets, motion, and visual chrome that favor iOS interaction patterns over a direct web port.

#### Scenario: Primary controls use native-feeling surfaces
- **WHEN** the groceries screen renders its header, mode switcher, and section chrome
- **THEN** those surfaces SHALL be composed primarily from `heroui-native` and Expo UI components
- **AND** the visual treatment SHALL favor iOS-native presentation such as segmented controls, sheets, and Liquid Glass-friendly surfaces where they improve clarity

#### Scenario: Grocery rows are optimized for handheld interaction
- **WHEN** grocery rows are rendered on a phone-sized viewport
- **THEN** row spacing, typography, and drag handles SHALL be sized for touch interaction
- **AND** row content SHALL remain readable without relying on desktop-density layouts

### Requirement: Mobile groceries support drag-and-drop reordering
The mobile groceries UI SHALL support drag-and-drop interactions for grocery rows using `react-native-reanimated-dnd` so users can reorder items and move them between supported containers.

#### Scenario: User reorders groceries inside a section
- **WHEN** the user drags a grocery row within a rendered section
- **THEN** the UI SHALL show live drag feedback
- **AND** the local list order SHALL update to reflect the new position after drop

#### Scenario: User moves a grocery into another supported section
- **WHEN** the user drags a grocery row from one supported section into another supported section
- **THEN** the target section SHALL show a valid drop state
- **AND** the local mock data SHALL update so the grocery appears in the target section after drop

### Requirement: Initial implementation remains UI-only
The first mobile groceries implementation SHALL use dummy data and local presentation state rather than shared hooks, contexts, or live grocery mutations.

#### Scenario: Screen renders without shared grocery wiring
- **WHEN** the groceries screen is implemented for the first pass
- **THEN** it SHALL source its content from local mock data or mock adapters
- **AND** it SHALL NOT require shared grocery hooks or contexts to render

#### Scenario: Future integration points remain isolated
- **WHEN** the UI exposes add-item actions, item actions, or state transitions
- **THEN** those interactions SHALL be isolated behind local handlers or placeholders
- **AND** the list presentation components SHALL remain reusable when real data wiring is added later
