## ADDED Requirements

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
