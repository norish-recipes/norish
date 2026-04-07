## ADDED Requirements

### Requirement: App launch does not display a black screen

The mobile app SHALL display the native splash screen until authentication state has resolved, and SHALL NOT display a black or blank screen at any point during launch.

#### Scenario: Splash screen remains visible during auth resolution

- **WHEN** the app starts and the auth session state has not yet been determined
- **THEN** the native splash screen SHALL remain visible
- **AND** no black or blank screen SHALL be shown to the user

#### Scenario: Splash screen dismissed after auth state is known

- **WHEN** the auth session state has been resolved (either authenticated or unauthenticated)
- **THEN** `SplashScreen.hideAsync()` SHALL be called
- **AND** the app SHALL transition directly to the appropriate screen (login or app shell) without a black frame

#### Scenario: Splash screen not reliant on minimize/restore

- **WHEN** the app launches normally (without the user minimizing and restoring the window)
- **THEN** content SHALL render correctly and the splash screen SHALL be dismissed
- **AND** the screen SHALL NOT remain black; the UI SHALL paint on the first compositor frame
