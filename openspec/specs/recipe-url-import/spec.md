# recipe-url-import Specification

## Purpose

TBD - created by syncing change adopt-recipe-scrapers-parser. Update Purpose after archive.

## Requirements

### Requirement: Python parser backend is the default for structured URL imports

The system SHALL use the Python `recipe-scrapers` backend as the default structured parser for non-video recipe URL imports.

#### Scenario: AI-only controls take precedence

- **WHEN** an import explicitly requests `forceAI` or global `alwaysUseAI` is enabled
- **THEN** the system SHALL bypass both Python and legacy structured parser backends
- **AND** the system SHALL use the existing AI extraction path directly

#### Scenario: Default backend selection

- **WHEN** a non-video recipe URL import starts, AI-only mode is not active, and the legacy rollback flag is not enabled
- **THEN** the system SHALL select the Python parser backend for structured extraction

#### Scenario: Existing video pipeline remains separate

- **WHEN** an imported URL is classified as a video import
- **THEN** the system SHALL continue using the existing video import pipeline instead of the Python structured parser backend

#### Scenario: Legacy rollback flag enabled

- **WHEN** the legacy rollback flag is enabled and AI-only mode is not active
- **THEN** the system SHALL use the deprecated legacy parser implementation for structured URL imports instead of the Python backend

### Requirement: Structured parser backends operate on fetched HTML plus source URL

The system SHALL fetch recipe pages in the existing Node import pipeline and provide the configured structured parser backend with the fetched HTML and original source URL.

#### Scenario: Python backend request payload

- **WHEN** the Python parser backend is selected for a URL import
- **THEN** the system SHALL send the fetched HTML and original source URL to the parser service

#### Scenario: Auth-aware fetching remains in the main import pipeline

- **WHEN** a URL import requires browser automation or site-auth tokens to obtain the page content
- **THEN** the system SHALL apply those fetch behaviors before invoking the configured structured parser backend

#### Scenario: No pre-parser recipe-likelihood gate on the Python path

- **WHEN** the Python parser backend is selected for a URL import
- **THEN** the system SHALL NOT reject the page using the legacy Node-side recipe-likelihood heuristic before calling the parser service

### Requirement: Structured URL parsing is served by a Norish-owned parser application

The system SHALL expose structured recipe parsing through a Norish-owned parser application that wraps the external `recipe-scrapers` package.

#### Scenario: Parser boundary ownership

- **WHEN** the structured parser backend is inspected
- **THEN** `recipe-scrapers` SHALL be used as a dependency of a Norish parser application
- **AND** the Node import pipeline SHALL integrate with the Norish parser application rather than treating `recipe-scrapers` itself as the deployable service boundary

### Requirement: Parser failures are machine-readable and AI fallback is eligibility-gated

The system SHALL return machine-readable parser failure reasons from the Python parser backend and only invoke AI fallback when the fetched page still appears likely to contain a recipe.

#### Scenario: Python backend returns a structured parser failure code

- **WHEN** the Python parser backend cannot produce a usable parse result because the site is unsupported or recipe schema cannot be extracted
- **THEN** the parser service SHALL return a machine-readable parser failure code
- **AND** that code SHALL preserve useful upstream categories such as `WebsiteNotImplementedError`, `NoSchemaFoundInWildMode`, or `RecipeSchemaNotFound`

#### Scenario: Parser failure still allows AI fallback

- **WHEN** the parser service returns a parser failure code or otherwise fails to return usable structured recipe data
- **AND** AI fallback is available
- **AND** the fetched page still appears likely to contain a recipe
- **THEN** the system SHALL continue to the existing AI extraction fallback path

#### Scenario: Parser failure blocks AI fallback for non-recipe-looking pages

- **WHEN** the parser service returns a parser failure code or otherwise fails to return usable structured recipe data
- **AND** AI fallback is available
- **AND** the fetched page does not appear likely to contain a recipe
- **THEN** the system SHALL fail the import without invoking AI extraction

#### Scenario: Parser backend fails while AI is disabled

- **WHEN** the parser service returns a parser failure code or otherwise fails to return usable structured recipe data
- **AND** AI fallback is not available
- **THEN** the system SHALL fail the import immediately

### Requirement: Recipe-scrapers dependency updates are deliberate and verifiable

The system SHALL pin the `recipe-scrapers` dependency version for the parser application and verify upgrades before they become active in production.

#### Scenario: Pinned dependency version

- **WHEN** the parser application's dependency manifest is inspected
- **THEN** the `recipe-scrapers` version SHALL be pinned explicitly rather than floating to the latest compatible release

#### Scenario: Verified dependency upgrade

- **WHEN** the `recipe-scrapers` version is upgraded
- **THEN** the parser application SHALL run the defined regression verification workflow before the upgrade is considered complete

### Requirement: URL imports preserve downstream normalization and fallback behavior

The system SHALL normalize structured parser output into Norish's recipe DTO format and preserve the existing downstream import flow, including AI fallback when structured extraction is unusable.

#### Scenario: Successful structured extraction

- **WHEN** the selected structured parser backend returns a title, at least one ingredient, and at least one step
- **THEN** the system SHALL normalize that result into the internal recipe DTO
- **AND** the system SHALL continue through the existing recipe creation and post-processing flow without requiring AI extraction

#### Scenario: Canonical URL is persisted when available

- **WHEN** the parser service returns a canonical URL for a successfully parsed recipe
- **THEN** the system SHALL persist that canonical URL as the recipe source URL

#### Scenario: Original URL remains the fallback source URL

- **WHEN** the parser service does not return a canonical URL for a successfully parsed recipe
- **THEN** the system SHALL persist the original requested URL as the recipe source URL

#### Scenario: Media behavior does not regress on the new parser path

- **WHEN** the parser service returns a parsed recipe with image or embedded video metadata
- **THEN** the system SHALL download and store media through the existing Norish media pipeline
- **AND** the system SHALL preserve the best available primary image
- **AND** the system SHALL preserve additional images when available
- **AND** the system SHALL preserve embedded recipe-page videos when available

#### Scenario: Ordered instructions are preserved

- **WHEN** the parser service exposes separable recipe instructions
- **THEN** the system SHALL preserve an ordered multi-step recipe in the normalized DTO

### Requirement: Category mapping is conservative and metadata-driven tags are preserved

The system SHALL map narrow Norish meal categories conservatively while preserving broader scraper metadata as normalized tags.

#### Scenario: Clear meal-category signal or close synonym is present

- **WHEN** scraper metadata clearly indicates `Breakfast`, `Lunch`, `Dinner`, or `Snack`, or a close synonym such as `Brunch`, `Supper`, `Appetizer`, `Dessert`, or `Side Dish`
- **THEN** the system SHALL map that signal into Norish categories

#### Scenario: Meal-category signal is weak or ambiguous

- **WHEN** scraper metadata does not clearly indicate one of Norish's supported meal categories
- **THEN** the system SHALL leave recipe categories empty rather than guessing

#### Scenario: Scraper metadata is normalized into tags

- **WHEN** the parser service returns metadata such as keywords, cuisine, category, or dietary restriction fields
- **THEN** the system SHALL normalize those values into lowercase deduplicated recipe tags

### Requirement: Legacy structured parser backend remains available as a deprecated rollback mode

The system SHALL provide a boolean runtime rollback flag that switches structured URL imports from the default Python backend to the legacy JSON-LD and microdata parser path.

#### Scenario: Legacy rollback mode enabled

- **WHEN** the rollback flag is enabled
- **THEN** the system SHALL use the deprecated legacy parser implementation for structured URL imports instead of the Python backend

#### Scenario: Legacy code is explicitly deprecated

- **WHEN** the legacy structured parser modules remain in the codebase for rollback support
- **THEN** they SHALL be marked as deprecated for maintainers and SHALL NOT be treated as the default structured parser path
