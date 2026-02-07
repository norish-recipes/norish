## MODIFIED Requirements

### Requirement: Platform-Specific Video Processing

The video import system SHALL use dedicated processors for each supported platform to handle platform-specific extraction strategies. All video processing functions SHALL accept optional site auth tokens for authenticated downloads.

#### Scenario: Instagram image post with OCR

- **WHEN** importing an Instagram URL that is an image post (no video duration)
- **THEN** the system SHALL extract text from the image using AI vision (OCR)
- **AND** the system SHALL parse the post description/caption
- **AND** the system SHALL merge OCR text with description for AI recipe extraction
- **AND** the system SHALL download the image as the recipe thumbnail
- **AND** the system SHALL NOT attempt audio transcription

#### Scenario: Instagram video post

- **WHEN** importing an Instagram URL that is a video post
- **THEN** the system SHALL download the video
- **AND** the system SHALL attempt to extract recipe from description first
- **AND** the system SHALL fall back to audio transcription if description extraction fails

#### Scenario: Facebook image post with OCR

- **WHEN** importing a Facebook URL that is an image post
- **THEN** the system SHALL extract text from the image using AI vision (OCR)
- **AND** the system SHALL parse the post description/caption
- **AND** the system SHALL merge OCR text with description for AI recipe extraction
- **AND** the system SHALL download the image as the recipe thumbnail
- **AND** the system SHALL NOT attempt audio transcription

#### Scenario: Facebook video post

- **WHEN** importing a Facebook URL that is a video post
- **THEN** the system SHALL download the video
- **AND** the system SHALL attempt to extract recipe from description first
- **AND** the system SHALL fall back to audio transcription if description extraction fails

#### Scenario: Generic video platform

- **WHEN** importing a video URL from an unsupported platform (not Instagram, Facebook, or YouTube)
- **THEN** the system SHALL download the video
- **AND** the system SHALL transcribe the audio using AI
- **AND** the system SHALL combine transcript with video description for extraction

#### Scenario: Platform detection

- **WHEN** a video URL is submitted for import
- **THEN** the system SHALL detect the platform from the URL hostname
- **AND** the system SHALL route to the appropriate platform processor

#### Scenario: Authenticated video download

- **WHEN** a video URL is submitted for import and the user has matching site auth tokens
- **THEN** the system SHALL load the user's tokens for the URL domain
- **AND** the system SHALL pass the tokens to the yt-dlp download functions
- **AND** the tokens SHALL be injected as `--add-header` or `--cookies` arguments
