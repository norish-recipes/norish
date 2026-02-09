## ADDED Requirements

### Requirement: Fullscreen Video Playback

The video player SHALL provide a fullscreen toggle button in the playback controls.

#### Scenario: User enters fullscreen mode

- **WHEN** user taps the fullscreen button while video is playing or paused
- **THEN** the video container SHALL enter fullscreen mode using the browser's Fullscreen API
- **AND** the button icon SHALL change to indicate "exit fullscreen"

#### Scenario: User exits fullscreen mode via button

- **WHEN** user taps the fullscreen button while in fullscreen mode
- **THEN** the video SHALL exit fullscreen mode
- **AND** the button icon SHALL change to indicate "enter fullscreen"

#### Scenario: User exits fullscreen via native controls

- **WHEN** user presses Escape or uses native browser controls to exit fullscreen
- **THEN** the video SHALL exit fullscreen mode
- **AND** the button state SHALL sync to show "enter fullscreen" icon

#### Scenario: Fullscreen API not supported

- **WHEN** the browser does not support the Fullscreen API
- **THEN** the fullscreen button SHALL be hidden
- **AND** video playback SHALL continue to function normally without fullscreen capability
