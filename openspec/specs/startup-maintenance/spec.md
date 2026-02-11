# startup-maintenance Specification

## Purpose

TBD - created by archiving change update-cleanup-workflows. Update Purpose after archive.

## Requirements

### Requirement: One-Time Startup Cleanup Runner

The server startup flow SHALL execute a one-time maintenance cleanup runner after startup prerequisites and before workers/server listening.

#### Scenario: Startup cleanup execution order

- **WHEN** the server process starts and startup prerequisites complete
- **THEN** the startup cleanup runner SHALL execute before worker startup and HTTP listen
- **AND** the runner SHALL trigger recipe media cleanup, calendar retention cleanup, and grocery retention cleanup

#### Scenario: Startup cleanup summary logging

- **WHEN** the startup cleanup runner completes
- **THEN** logs SHALL include per-domain cleanup summaries for recipe media, calendar, and groceries

### Requirement: Daily Cleanup Scheduling Remains Active

The system SHALL continue to register daily cleanup jobs in addition to the startup cleanup run.

#### Scenario: Scheduled cleanup jobs are initialized

- **WHEN** scheduled jobs are initialized during startup
- **THEN** daily cleanup jobs for recipe media, calendar retention, and grocery retention SHALL be registered with the midnight schedule

#### Scenario: Media cleanup uses media-scoped naming

- **WHEN** cleanup jobs and logs refer to recipe upload cleanup
- **THEN** they SHALL use media-scoped naming rather than image-only naming
