## ADDED Requirements

### Requirement: Calendar Retention Window Cleanup

The retention cleanup process SHALL delete old calendar planned items using the configured `SCHEDULER_CLEANUP_MONTHS` value.

#### Scenario: Calendar items older than cutoff are deleted

- **WHEN** calendar cleanup runs
- **THEN** the cutoff date SHALL be computed as the first day of `(current month - SCHEDULER_CLEANUP_MONTHS)`
- **AND** `planned_items` rows with `date <= cutoff` SHALL be deleted

#### Scenario: Calendar items inside retention window are preserved

- **WHEN** a planned item date is greater than the computed cutoff date
- **THEN** the planned item SHALL remain

### Requirement: Grocery Retention Window Cleanup

The retention cleanup process SHALL delete old done groceries using `SCHEDULER_CLEANUP_MONTHS` and SHALL exclude recurring groceries.

#### Scenario: Old done non-recurring groceries are deleted

- **WHEN** grocery cleanup runs
- **THEN** the cutoff date SHALL be computed as the first day of `(current month - SCHEDULER_CLEANUP_MONTHS)`
- **AND** groceries with `is_done = true`, `updated_at <= cutoff`, and `recurring_grocery_id IS NULL` SHALL be deleted

#### Scenario: Recurring groceries are preserved

- **WHEN** a grocery item has a non-null `recurring_grocery_id`
- **THEN** the cleanup process SHALL NOT delete that item as part of old grocery retention cleanup

### Requirement: Retention Cleanup Observability

Calendar and grocery retention cleanup runs SHALL provide verifiable execution outputs for cutoff date and deletion counts.

#### Scenario: Cleanup run logs retention parameters

- **WHEN** calendar or grocery retention cleanup executes
- **THEN** logs SHALL include the computed cutoff date and configured retention months

#### Scenario: Cleanup run reports deletion counts

- **WHEN** cleanup completes
- **THEN** each cleanup function SHALL report the number of rows deleted
