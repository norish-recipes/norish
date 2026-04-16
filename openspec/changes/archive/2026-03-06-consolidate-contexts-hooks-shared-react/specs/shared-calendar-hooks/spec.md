## ADDED Requirements

### Requirement: Shared React exposes reusable calendar hook family

`@norish/shared-react` SHALL expose a `createCalendarHooks` factory that returns calendar query, mutation, cache, and subscription hooks using tRPC binding injection.

#### Scenario: Shared calendar hooks are available to both apps

- **WHEN** web and mobile import shared calendar hooks
- **THEN** both apps SHALL resolve the same shared-react hook factories
- **AND** shared calendar modules SHALL NOT import platform runtime modules

### Requirement: Calendar hook family includes query, mutation, cache, and subscription hooks

The `createCalendarHooks` factory SHALL return hooks covering the meal planning calendar lifecycle.

#### Scenario: Complete calendar hook family is returned

- **WHEN** an app calls `createCalendarHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useCalendarQuery`, `useCalendarMutations`, `useCalendarCache`, and `useCalendarSubscription`

### Requirement: Platform-specific calendar hooks remain in app wrappers

Complex UI-interaction hooks like calendar drag-and-drop (`use-calendar-dnd`) SHALL remain as platform-specific app hooks.

#### Scenario: DnD hook stays in web app

- **WHEN** the calendar hook family is created in shared-react
- **THEN** `useCalendarDnd` SHALL NOT be included in the shared factory
- **AND** it SHALL remain in the web app's hooks directory
