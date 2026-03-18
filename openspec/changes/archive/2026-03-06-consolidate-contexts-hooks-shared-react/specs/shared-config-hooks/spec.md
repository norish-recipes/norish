## MODIFIED Requirements

### Requirement: Shared React exposes reusable config hook family

`@norish/shared-react` SHALL expose a `createConfigHooks` factory that returns all config-related query hooks using tRPC binding injection, including the version query hook.

#### Scenario: Complete config hook family is returned

- **WHEN** an app calls `createConfigHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useLocaleConfigQuery`, `useRecurrenceConfigQuery`, `useTagsQuery`, `useTimerKeywordsQuery`, `useTimersEnabledQuery`, `useUnitsQuery`, `useUploadLimitsQuery`, and `useVersionQuery`
- **AND** all hooks SHALL use the injected tRPC binding
