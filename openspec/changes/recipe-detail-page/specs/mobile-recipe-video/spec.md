## ADDED Requirements

### Requirement: Video playback in recipe hero

The recipe detail hero media carousel SHALL support video items alongside images, with inline playback controls.

#### Scenario: Recipe has a video as primary media

- **WHEN** a recipe's media items include a video
- **THEN** the video SHALL render in the hero carousel at the same dimensions as images
- **AND** the video SHALL display a play/pause overlay control

#### Scenario: Video auto-plays on visibility

- **WHEN** a video item becomes the active carousel page and is visible on screen
- **THEN** the video SHALL begin playing automatically in muted state
- **AND** a mute/unmute toggle SHALL be visible

#### Scenario: Video pauses when scrolled away

- **WHEN** the user scrolls the hero area off screen or swipes to a different carousel page
- **THEN** the video SHALL pause playback
- **AND** playback position SHALL be preserved

#### Scenario: User unmutes video

- **WHEN** user taps the mute/unmute toggle while video is playing
- **THEN** audio SHALL be enabled
- **AND** the toggle icon SHALL update to reflect unmuted state

#### Scenario: User enters fullscreen video

- **WHEN** user taps the fullscreen button on a video
- **THEN** the video SHALL enter native iOS fullscreen playback
- **AND** standard iOS video controls SHALL be available in fullscreen

#### Scenario: Video fails to load

- **WHEN** a video source cannot be loaded (network error, unsupported format)
- **THEN** the carousel item SHALL fall back to displaying the video's thumbnail image if available
- **AND** if no thumbnail is available, a placeholder with an error icon SHALL render
- **AND** the error SHALL NOT crash the app or block other media items

### Requirement: Video items integrate with media carousel

Video items SHALL appear in the same carousel as image items, ordered by their `order` field.

#### Scenario: Mixed media carousel ordering

- **WHEN** a recipe has both images and videos with defined order values
- **THEN** the carousel SHALL display items sorted by their `order` field regardless of media type
- **AND** dot indicators SHALL represent all items (images and videos combined)

#### Scenario: Video with authenticated source

- **WHEN** a video source requires authentication headers
- **THEN** the video player SHALL include the same auth headers used for image requests
- **AND** playback SHALL function correctly with authenticated sources
