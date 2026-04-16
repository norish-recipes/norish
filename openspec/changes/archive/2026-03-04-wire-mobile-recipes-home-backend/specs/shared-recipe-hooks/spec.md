## ADDED Requirements

### Requirement: Shared React exposes reusable recipe hook families

`@norish/shared-react` SHALL expose reusable recipe hooks that can be consumed by both web and mobile and are organized into explicit dashboard and recipe families.

#### Scenario: Shared recipe families are available to both apps

- **WHEN** web and mobile import shared recipe hooks
- **THEN** both apps SHALL resolve the same shared-react hook families
- **AND** shared recipe modules SHALL NOT import platform runtime modules from `apps/web/**` or `apps/mobile/**`

### Requirement: Shared recipe hooks support app-owned tRPC binding injection

Shared recipe hooks SHALL allow each app to inject its own typed `useTRPC` binding using the same factory/binding pattern used by shared config hooks.

#### Scenario: Web binds app-owned tRPC to shared recipe hooks

- **WHEN** web initializes shared recipe hooks
- **THEN** web SHALL inject its app-owned typed `useTRPC` binding
- **AND** shared recipe query behavior SHALL remain identical regardless of app binding source

#### Scenario: Mobile binds app-owned tRPC to shared recipe hooks

- **WHEN** mobile initializes shared recipe hooks
- **THEN** mobile SHALL inject its app-owned typed `useTRPC` binding
- **AND** shared recipe hooks SHALL execute without requiring web-only dependencies

### Requirement: Dashboard and recipe hooks have clear usage boundaries

The shared recipe hook surface SHALL separate dashboard hooks from recipe hooks so each surface has clear intent and default usage.

#### Scenario: Dashboard surfaces use dashboard hook family

- **WHEN** a home/dashboard section loads recipe data (`Continue Cooking`, `Discover`, `Your Collection`)
- **THEN** it SHALL consume hooks from the dashboard family
- **AND** implementation SHALL NOT require importing recipe-family detail hooks for section-level data retrieval

#### Scenario: Recipe-detail surfaces use recipe hook family

- **WHEN** a recipe detail or item-level workflow loads or mutates one recipe
- **THEN** it SHALL consume hooks from the recipe family
- **AND** implementation SHALL NOT rely on dashboard-family hooks for single-recipe ownership logic

### Requirement: Platform-specific composition remains in app wrappers

Platform-specific side effects and composition logic SHALL remain app-owned wrappers while shared-react owns reusable recipe query behavior.

#### Scenario: Wrappers compose platform concerns outside shared query core

- **WHEN** web or mobile needs navigation, storage, toast, or media-payload handling
- **THEN** that behavior SHALL be implemented in app wrappers around shared hooks
- **AND** shared recipe hook internals SHALL remain platform-agnostic
