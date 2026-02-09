# timer-notifications Specification

## Purpose

TBD - created by archiving change improve-timer-system. Update Purpose after archive.

## Requirements

### Requirement: Timer Completion Background Notification

The system SHALL display an OS-level notification when a cooking timer completes and the app is not in the foreground.

The notification MUST be delivered via `ServiceWorkerRegistration.showNotification()` to ensure delivery even when the page is backgrounded or the screen is off.

The notification MUST include the timer label (e.g., "Step 3 Timer") and the recipe name when available.

The system SHALL NOT show an OS notification when the app is in the foreground — the existing in-app audio alert SHALL remain the primary foreground mechanism.

#### Scenario: Timer completes while app is backgrounded

- **WHEN** a running timer reaches 0:00
- **AND** the document is hidden (`document.hidden === true`)
- **THEN** the system displays an OS notification with the timer label and recipe name
- **AND** the in-app audio alert still plays (browsers may allow background audio)

#### Scenario: Timer completes while app is in foreground

- **WHEN** a running timer reaches 0:00
- **AND** the document is visible (`document.hidden === false`)
- **THEN** the system plays the existing audio alert
- **AND** no OS notification is shown

#### Scenario: Notification API unavailable

- **WHEN** a timer completes in the background
- **AND** the browser does not support the Notification API or the service worker is not registered
- **THEN** the system SHALL fall back to audio-only alerting
- **AND** log a warning via the client logger

### Requirement: Notification Permission Request

The system SHALL request notification permission at a contextually appropriate moment — specifically when the user first starts a cooking timer — not on page load or app startup.

The system SHALL NOT re-prompt for permission if the user has already granted or denied it.

#### Scenario: First timer activation triggers permission request

- **WHEN** the user clicks a timer chip to start their first timer
- **AND** notification permission state is `default` (not yet asked)
- **THEN** the system calls `Notification.requestPermission()`
- **AND** the timer starts regardless of the permission outcome

#### Scenario: Permission previously granted

- **WHEN** the user starts a timer
- **AND** notification permission is already `granted`
- **THEN** no permission prompt is shown
- **AND** the timer starts normally

#### Scenario: Permission previously denied

- **WHEN** the user starts a timer
- **AND** notification permission is `denied`
- **THEN** no permission prompt is shown
- **AND** the timer dock displays a subtle indicator that notifications are disabled

### Requirement: Notification Click Navigation

The service worker SHALL handle `notificationclick` events to bring the user back to the app.

#### Scenario: User clicks a timer completion notification

- **WHEN** the user taps/clicks the OS notification
- **THEN** the service worker focuses an existing app window if one is open
- **OR** opens a new window to the app's root URL if no window is open
- **AND** the notification is dismissed

### Requirement: Notification Permission Status Indicator

The timer dock SHALL display a non-intrusive indicator when notification permission is `denied`, informing the user that background alerts are unavailable.

#### Scenario: Permission denied indicator in timer dock

- **WHEN** the timer dock is expanded
- **AND** notification permission is `denied`
- **THEN** a small text hint is shown (e.g., "Notifications blocked — enable in browser settings")
- **AND** the indicator does not interfere with timer controls
