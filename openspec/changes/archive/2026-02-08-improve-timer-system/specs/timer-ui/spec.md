## ADDED Requirements

### Requirement: Timer Chip Valid Styling

The timer chip component SHALL use only valid Tailwind CSS utility classes and avoid invalid or non-existent class names.

#### Scenario: Timer chip renders with correct font class

- **WHEN** a timer chip is rendered (active or inactive)
- **THEN** it uses a valid Tailwind font/text size class (e.g., `text-base`)
- **AND** no invalid classes like `font-lg` are present

### Requirement: Timer Segment Type Safety

The smart instruction component SHALL use a properly typed interface for timer segment data instead of the `any` type, in accordance with the project's "no type suppression" convention.

#### Scenario: Timer segment data is fully typed

- **WHEN** the `SmartInstruction` component creates timer segments
- **THEN** the segment data property uses a named TypeScript interface (e.g., `TimerSegmentData`)
- **AND** all properties (`timerId`, `recipeId`, `recipeName`, `label`, `durationMs`, `originalText`) are explicitly typed

### Requirement: Timer Dock Design Token Compliance

The timer dock component SHALL use the app's semantic design token classes (from the HeroUI/Tailwind theme) instead of hardcoded color values, ensuring automatic light/dark mode support and visual consistency with the rest of the application.

#### Scenario: Timer dock uses design tokens for surfaces

- **WHEN** the timer dock is rendered (collapsed or expanded)
- **THEN** surface backgrounds use `bg-content1`, `bg-content2` tokens
- **AND** text uses `text-foreground`, `text-default-500` tokens
- **AND** borders and dividers use `border-default-200`, `bg-default-200` tokens
- **AND** danger states use `bg-danger`, `text-danger` tokens
- **AND** no hardcoded `zinc-*`, `white`, or `red-*` color classes are present

#### Scenario: Timer dock expanded panel matches card styling

- **WHEN** the timer dock is expanded
- **THEN** the panel uses `rounded-2xl` border radius consistent with the app's card convention
- **AND** the visual appearance is consistent across light and dark modes

### Requirement: Timer Parser Multilingual Robustness

The timer parser regex SHALL NOT append hardcoded language-specific suffixes (like `(?:en|s)?`) that could cause false positive matches. Keyword matching SHALL rely solely on the configured keyword list.

#### Scenario: Parser does not match invalid suffixed keywords

- **WHEN** the parser scans text containing a word like "minutess" or "minutesen"
- **AND** neither "minutess" nor "minutesen" is in the configured keyword list
- **THEN** no timer match is produced for that word

#### Scenario: Parser matches configured keywords exactly

- **WHEN** the parser scans text containing "15 minuten"
- **AND** "minuten" is in the configured minutes keyword list
- **THEN** a timer match of 15 minutes (900 seconds) is produced
