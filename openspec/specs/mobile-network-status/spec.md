## ADDED Requirements

### Requirement: Network status context exposes app reachability state

The mobile app SHALL expose a `NetworkProvider` context and a `useNetworkStatus()` hook that provides `deviceOnline`, `backendReachable`, `appOnline`, and `mode`, where `mode` is `offline | backend-unreachable | online`.

#### Scenario: Device and backend are both reachable

- **WHEN** `expo-network` reports internet connectivity
- **AND** the configured backend health probe succeeds
- **THEN** `useNetworkStatus()` SHALL return `{ deviceOnline: true, backendReachable: true, appOnline: true, mode: 'online' }`

#### Scenario: Device is offline

- **WHEN** `expo-network` reports no internet connectivity
- **THEN** `useNetworkStatus()` SHALL return `{ deviceOnline: false, backendReachable: false, appOnline: false, mode: 'offline' }`

#### Scenario: Device is online but the backend is unreachable

- **WHEN** `expo-network` reports internet connectivity
- **AND** backend health probes fail past the configured failure threshold
- **THEN** `useNetworkStatus()` SHALL return `{ deviceOnline: true, backendReachable: false, appOnline: false, mode: 'backend-unreachable' }`

---

### Requirement: Network status tracks an internal bootstrap runtime state

The mobile app SHALL track an internal runtime state during startup and reachability restoration so bootstrap work is not misrepresented as a user-visible fourth reachability mode.

#### Scenario: Startup restore and initial probe are still in flight

- **WHEN** persisted cache hydration and/or the initial backend reachability probe has not finished
- **THEN** the reachability system SHALL remain in an internal `initializing` runtime state
- **AND** the app SHALL NOT present `offline` or `backend-unreachable` as a settled visible state solely because bootstrap is incomplete

#### Scenario: Runtime state settles after bootstrap

- **WHEN** cache hydration and the first reachability determination complete
- **THEN** the internal runtime state SHALL transition to `ready`
- **AND** public consumers SHALL rely on `mode` being one of `offline | backend-unreachable | online`

---

### Requirement: Dependent systems react to app-online transitions

The `NetworkProvider` SHALL track `appOnline` transitions so dependent systems can react when live server work becomes possible or impossible.

#### Scenario: App becomes reachable again

- **WHEN** `appOnline` transitions from `false` to `true`
- **THEN** dependent reconnect logic such as cache invalidation and session re-validation SHALL run

#### Scenario: App loses live reachability

- **WHEN** `appOnline` transitions from `true` to `false`
- **THEN** dependent systems SHALL observe `appOnline === false`
- **AND** live server work SHALL pause until reachability is restored

---

### Requirement: TanStack Query online-manager reflects app reachability

The mobile app SHALL wire the derived `appOnline` state into TanStack Query's `onlineManager` so that query and mutation behavior respects backend reachability, not just raw device connectivity.

#### Scenario: Backend becomes unreachable while device stays online

- **WHEN** `deviceOnline === true`
- **AND** backend health probes mark the configured backend unreachable
- **THEN** `onlineManager.isOnline()` SHALL return `false`
- **AND** paused queries SHALL NOT retry until `appOnline` becomes `true` again

#### Scenario: App returns to online state

- **WHEN** `appOnline` becomes `true`
- **THEN** `onlineManager.isOnline()` SHALL return `true`
- **AND** paused queries SHALL resume automatically

---

### Requirement: NetworkProvider is mounted above consumers

The `NetworkProvider` SHALL be mounted in the mobile app's root layout, above the tRPC provider and auth provider, so that all downstream consumers can access network state.

#### Scenario: Hook used outside provider

- **WHEN** `useNetworkStatus()` is called outside of a `NetworkProvider`
- **THEN** it SHALL throw an error with a descriptive message
