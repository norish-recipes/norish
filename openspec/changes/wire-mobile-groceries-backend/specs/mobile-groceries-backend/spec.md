## ADDED Requirements

### Requirement: Mobile recurrence panel preserves editor state

The mobile groceries editor SHALL present recurrence configuration in a full-height panel and SHALL restore the grocery editor with the selected recurrence settings intact when the recurrence panel closes.

#### Scenario: Recurrence panel opens full height

- **WHEN** a user opens recurrence settings from the grocery editor
- **THEN** the recurrence panel opens at a full-height detent
- **AND** the current recurrence enabled state and frequency selection are shown

#### Scenario: Returning to the editor preserves recurrence settings

- **WHEN** a user confirms recurrence settings from the recurrence panel
- **THEN** the recurrence panel closes
- **AND** the grocery editor is visible again
- **AND** the editor displays the selected recurrence state without losing item text or store selection

### Requirement: Mobile groceries read flow uses backend data

The mobile groceries screen SHALL render household grocery data from the shared tRPC-backed groceries hooks instead of mock data.

#### Scenario: Grocery list renders from backend query

- **WHEN** the groceries query succeeds with grocery items, recurring groceries, stores, and recipe metadata
- **THEN** the mobile Groceries tab renders rows grouped by the selected store or recipe view mode
- **AND** recurring groceries are visually represented with their recurrence state

#### Scenario: Grocery list handles empty and loading states

- **WHEN** the groceries query is loading
- **THEN** the mobile Groceries tab shows a loading state instead of mock groceries
- **WHEN** the groceries query succeeds with no grocery items
- **THEN** the mobile Groceries tab shows an empty state with a clear path to add a grocery

#### Scenario: Grocery subscriptions update the visible list

- **WHEN** another household member creates, updates, completes, deletes, or changes a recurring grocery
- **THEN** the mobile Groceries tab receives the subscription event through the shared groceries subscription hook
- **AND** the visible list updates without requiring a manual refresh

### Requirement: Mobile done flow persists to backend

The mobile groceries screen SHALL persist done and undone changes through shared groceries mutations while preserving the current delayed completed-item sorting behavior.

#### Scenario: Mark one-off grocery done or undone

- **WHEN** a user toggles a one-off grocery row done or undone
- **THEN** the mobile app calls the shared groceries toggle mutation with the target grocery version
- **AND** the row immediately reflects the requested state
- **AND** the row remains pinned until the mobile completion animation delay finishes

#### Scenario: Mark recurring grocery done or undone

- **WHEN** a user toggles a grocery row linked to a recurring grocery
- **THEN** the mobile app calls the shared recurring grocery toggle mutation with grocery and recurring versions
- **AND** the recurring schedule state is updated from the backend-backed cache or subscription event

### Requirement: Mobile create, edit, and delete flow persists to backend

The mobile groceries editor SHALL create, edit, assign, and delete one-off and recurring groceries through shared groceries mutations.

#### Scenario: Create one-off grocery

- **WHEN** a user submits the grocery editor with recurrence disabled
- **THEN** the mobile app calls the shared create grocery mutation with the item text and selected store
- **AND** the created grocery appears from the shared cache or subscription event

#### Scenario: Create recurring grocery

- **WHEN** a user submits the grocery editor with recurrence enabled and a selected frequency
- **THEN** the mobile app maps the selected frequency to a recurrence pattern
- **AND** calls the shared create recurring grocery mutation with the item text, recurrence pattern, and selected store

#### Scenario: Edit one-off grocery

- **WHEN** a user edits a one-off grocery row and saves changes
- **THEN** the mobile app calls shared update and store-assignment mutations as needed
- **AND** the editor closes after the save request is accepted by the local mutation layer

#### Scenario: Edit recurring grocery

- **WHEN** a user edits a grocery row linked to a recurring grocery and saves changes
- **THEN** the mobile app calls the shared recurring update mutation when recurrence remains enabled
- **AND** the mobile app removes recurrence through the shared recurring update flow when recurrence is disabled

#### Scenario: Delete grocery

- **WHEN** a user deletes a grocery from the mobile editor or swipe action
- **THEN** the mobile app calls the shared delete mutation for one-off groceries
- **AND** calls the shared delete recurring grocery mutation for rows linked to recurring groceries

### Requirement: Mobile grocery interactions remain native and stable

The mobile groceries backend wiring SHALL preserve current native interaction patterns unless backend semantics make a specific interaction unsupported.

#### Scenario: Store and recipe view modes remain available

- **WHEN** a user switches between store and recipe view modes
- **THEN** the mobile Groceries tab keeps using the selected view mode with backend-backed grocery data

#### Scenario: Store reorder uses backend-supported mutation

- **WHEN** a user reorders groceries within a store-backed section
- **THEN** the mobile app persists supported reorder updates through the shared reorder-in-store mutation
- **AND** unsupported reorder contexts are not silently persisted as successful backend changes
