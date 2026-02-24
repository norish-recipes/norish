## ADDED Requirements

### Requirement: Shared Hook and Context Runtime Boundary

Hooks and contexts published from shared package(s) SHALL remain runtime-agnostic and SHALL NOT directly import platform-specific frameworks or globals.

#### Scenario: Shared modules avoid web-framework imports

- **WHEN** a hook or context is located in shared package paths under `packages/*`
- **THEN** it SHALL NOT import from `next/*`
- **AND** it SHALL NOT import app-local modules from `apps/web/**`

#### Scenario: Shared modules avoid direct browser global coupling

- **WHEN** a hook or context requires platform side effects (for example navigation, storage, notifications, viewport visibility, clipboard, wake lock)
- **THEN** the shared module SHALL consume those effects through an injected adapter interface
- **AND** direct references to browser globals (`window`, `document`, `localStorage`, `navigator`, `Notification`) SHALL remain outside shared module implementations

### Requirement: Non-Shareable Module Inventory

The repository SHALL maintain an explicit inventory for hooks/contexts that remain outside shared package(s), including the blocking reason and migration trigger.

#### Scenario: Web-only modules are traceable

- **WHEN** a hook or context stays in `apps/web`
- **THEN** documentation SHALL record its classification as `web-only`
- **AND** documentation SHALL include the specific blocking dependency and owner
- **AND** documentation SHALL include a future trigger that would allow migration to shared package(s)
