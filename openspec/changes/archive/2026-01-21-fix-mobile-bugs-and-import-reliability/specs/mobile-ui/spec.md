## ADDED Requirements

### Requirement: Safe-Area-Top Offset

The app layout SHALL account for device safe areas to prevent content from overlapping with system UI elements like the iOS Dynamic Island or notch.

#### Scenario: App layout on notched device

- **WHEN** the app is viewed on a device with a notch or Dynamic Island
- **THEN** the main content area SHALL have top padding that includes `env(safe-area-inset-top)`
- **AND** content SHALL NOT overlap with the device's safe area

#### Scenario: App layout on non-notched device

- **WHEN** the app is viewed on a device without a notch
- **THEN** the layout SHALL gracefully fall back to standard padding
- **AND** `env(safe-area-inset-top)` SHALL return 0px

### Requirement: Image Lightbox Safe-Area Positioning

The image lightbox close button and navigation elements SHALL respect device safe areas.

#### Scenario: Close button on notched device

- **WHEN** the image lightbox is opened on a device with a notch
- **THEN** the close button SHALL be positioned below the safe area inset
- **AND** the close button SHALL be fully accessible and not obscured by system UI

#### Scenario: Image counter on notched device

- **WHEN** the image lightbox displays multiple images on a notched device
- **THEN** the image counter SHALL be positioned below the safe area inset

### Requirement: Remove Keyboard Offset Hook

The Panel component SHALL NOT use the unreliable `useKeyboardOffset` hook and SHALL rely on `dvh` units for keyboard-aware sizing.

#### Scenario: Panel with keyboard open

- **WHEN** the virtual keyboard is open on mobile
- **THEN** the Panel SHALL automatically adjust its height using `dvh` units
- **AND** the Panel SHALL NOT use JavaScript-based keyboard offset calculations
