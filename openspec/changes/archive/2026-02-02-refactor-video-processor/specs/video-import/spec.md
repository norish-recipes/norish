## MODIFIED Requirements

### Requirement: YouTube Caption Extraction

The video import system SHALL use existing YouTube captions when available, combined with video description, before falling back to audio transcription.

#### Scenario: YouTube video with auto-generated captions

- **WHEN** importing a YouTube video that has auto-generated captions
- **THEN** the system SHALL download captions using `--write-auto-sub` flag
- **AND** the system SHALL parse the VTT caption file
- **AND** the system SHALL combine caption text with video description for AI extraction

#### Scenario: YouTube video without captions

- **WHEN** importing a YouTube video that has no captions available
- **THEN** the system SHALL fall back to audio transcription
- **AND** the system SHALL combine transcript with video description for AI extraction

#### Scenario: Caption file cleanup

- **WHEN** caption extraction is complete (success or failure)
- **THEN** the temporary caption file SHALL be deleted
- **AND** no caption files SHALL remain in the temp directory

#### Scenario: Recipe in description only

- **WHEN** a YouTube video has the recipe in the description but not in spoken words
- **THEN** the system SHALL include video description in AI extraction input
- **AND** the recipe SHALL be successfully extracted from description content

## ADDED Requirements

### Requirement: Platform-Specific Video Processing

The video import system SHALL use dedicated processors for each supported platform to handle platform-specific extraction strategies.

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

### Requirement: Video Processor Architecture

The video import system SHALL implement a strategy pattern with a factory for platform-specific processing.

#### Scenario: Processor factory routing

- **WHEN** `processVideoRecipe()` is called with a URL
- **THEN** the factory SHALL select the appropriate processor based on URL
- **AND** the selected processor SHALL handle the complete extraction workflow

#### Scenario: Adding new platform support

- **WHEN** a new video platform needs to be supported
- **THEN** a new processor class implementing the `VideoProcessor` interface SHALL be created
- **AND** the factory SHALL be updated to recognize the new platform's URLs
