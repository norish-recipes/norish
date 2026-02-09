# Capability: Recipe Timers

Interactive cooking timers embedded in recipe step instructions with multilingual detection and configurable keywords.

## ADDED Requirements

### Requirement: Timer keyword configuration MUST use categorized structure

**Priority**: Critical  
**Status**: Draft

The system MUST store and manage timer detection keywords in a categorized structure with separate arrays for hours, minutes, and seconds to enable accurate multilingual parsing and type-safe configuration.

#### Scenario: Admin configures timer keywords with categorized structure

**Given** an admin is on the Content Detection settings page  
**When** they edit timer keywords  
**Then** they see three separate text fields: "Hour Keywords", "Minute Keywords", "Second Keywords"  
**And** each field accepts comma-separated keywords  
**And** saving sends categorized structure: `{ hours: [...], minutes: [...], seconds: [...] }`  
**And** the database stores categorized arrays  
**And** the parser receives categorized arrays

**Validation**:

- UI component interface matches `TimerKeywordsConfig` schema
- Query hook returns correct structure with all three arrays
- Seeding logic compares all three arrays
- Tests validate actual schema properties (hours, minutes, seconds)

---

### Requirement: Parser MUST receive categorized keywords from configuration

**Priority**: Critical  
**Status**: Draft

The timer parser MUST receive keyword configuration in the expected format: `{ hours: string[], minutes: string[], seconds: string[] }` to enable accurate time unit detection across multiple languages.

#### Scenario: SmartInstruction passes categorized keywords to parser

**Given** a recipe step contains "Bake for 30 minuten"  
**And** timer keywords config includes Dutch: `{ minutes: ["minuten", "minuut", ...] }`  
**When** SmartInstruction renders the step  
**Then** it calls `parseTimerDurations(text, { hours: config.hours, minutes: config.minutes, seconds: config.seconds })`  
**And** the parser receives a valid categorized structure  
**And** the parser detects "30 minuten" as 30 minutes  
**And** a TimerChip is rendered

**Validation**:

- No undefined passed to parser
- Parser receives all three keyword arrays
- Multi-language detection works
- Timer chips render correctly

---

### Requirement: Timer keywords MUST support multilingual detection

**Priority**: High  
**Status**: Draft

The system MUST detect time durations in multiple languages using configurable keywords, defaulting to English, German, French, and Dutch support.

#### Scenario: Recipe in German uses German time keywords

**Given** a recipe step text is "Backen für 30 Minuten bei 180°C"  
**And** timer keywords config includes German: `{ minutes: ["minute", "minuten", "min"] }`  
**When** the step is rendered  
**Then** "30 Minuten" is detected as a timer duration  
**And** a TimerChip is displayed for 30 minutes  
**And** clicking the chip starts a 30-minute timer

**Validation**:

- Default config includes keywords for: English, German, French, Dutch
- Custom keywords can be added via admin UI
- Parser correctly maps keywords to time units
- Multiple languages work in same recipe

---

### Requirement: Ingredient quantity formatting MUST coexist with timer detection

**Priority**: High  
**Status**: Draft

Recipe steps MUST format ingredient quantities (bold) and UOMs (primary color) alongside timer durations without conflicts, maintaining the formatting behavior from rc/v0.16.0.

#### Scenario: Step contains both ingredient quantities and timers

**Given** a recipe step text is "Simmer 2 cups tomatoes for 20 minutes"  
**When** the step is rendered  
**Then** "2" displays in **bold**  
**And** "cups" displays in **primary color**  
**And** "20 minutes" displays as a clickable TimerChip  
**And** both features render without overlap  
**And** markdown formatting still works (headings, links, etc.)

**Validation**:

- SmartInstruction uses `parseIngredientWithDefaults` for quantity formatting
- Timer detection works independently
- No rendering conflicts between quantity formatting and timer chips
- Both features tested together
- Original quantity formatting behavior from rc/v0.16.0 restored

#### Scenario: Locale-aware ingredient quantity formatting

**Given** a recipe step in German: "200 g Mehl hinzufügen"  
**And** locale is set to German  
**When** the step is rendered  
**Then** "200" displays in **bold**  
**And** "g" displays in **primary color** (recognized as German unit)  
**And** parsing uses locale-aware units from configuration

**Validation**:

- `parseIngredientWithDefaults` receives locale-aware units
- German, French, Dutch units formatted correctly
- Follows same pattern as English units

---

### Requirement: Timer configuration MUST sync from default file when not overridden

**Priority**: High  
**Status**: Draft

The system MUST automatically sync timer keyword configuration from the default JSON file when the admin has not overridden it, ensuring updates to default keywords are applied without manual intervention.

#### Scenario: Default keywords file updated and user hasn't customized

**Given** timer keywords in database have `isOverridden: false`  
**And** stored config has `{ hours: ["hour", "hours"] }`  
**When** `config/timer-keywords.default.json` is updated to `{ hours: ["hour", "hours", "hr"] }`  
**And** server restarts  
**Then** the seeding process detects the difference  
**And** updates database to match new default file  
**And** `isOverridden` remains `false`  
**And** admin UI shows new keywords

**Validation**:

- Seeding compares `hours`, `minutes`, `seconds` arrays
- Only updates when `isOverridden: false`
- Respects user customizations (isOverridden: true)
- All three arrays are compared correctly

---

## MODIFIED Requirements

### Requirement: Timer tick loop MUST only run when timers are active

**Priority**: Medium  
**Status**: Draft  
**Modified From**: Original implementation ran unconditionally

The timer tick loop MUST only execute when at least one timer is in "running" state to conserve CPU resources and improve performance.

#### Scenario: No timers are running

**Given** the TimerDock component is mounted  
**And** no timers exist or all timers are paused/completed  
**When** the component renders  
**Then** no setInterval tick loop is started  
**And** CPU usage is minimal  
**And** when a timer is started, the tick loop begins  
**And** when all timers stop, the tick loop ends

**Validation**:

- Check `hasRunningTimers` before starting interval
- Interval cleanup when no active timers
- Performance benchmark shows reduced CPU usage

---

### Requirement: Timer keywords editor MUST validate all three categories

**Priority**: High  
**Status**: Draft  
**Modified From**: Original single-field validation

The admin UI MUST validate that at least one keyword exists in at least one category (hours, minutes, or seconds) when timer detection is enabled.

#### Scenario: Admin enables timer detection with empty keywords

**Given** admin is editing timer keywords  
**And** timer detection is enabled  
**When** they clear all keywords from all three fields  
**And** click save  
**Then** validation error displays: "At least one keyword required in hours, minutes, or seconds"  
**And** save button is disabled  
**And** config is not sent to server

**Validation**:

- Check all three arrays for length > 0
- Allow empty arrays if timer detection disabled
- Show field-specific errors if needed

---

## Implementation Notes

### Database Schema

- No changes required - schema is already correct
- `TimerKeywordsSchema` already defines categorized structure
- Default value includes all three arrays

### UI Components

- `timer-keywords-editor.tsx`: Complete rewrite with three text fields
- `content-detection-card.tsx`: Update props passed to editor
- `context.tsx`: Ensure type safety throughout

### Parser Integration

- `smart-instruction.tsx`: Fix parser call to pass categorized structure
- Add null checks and error boundaries
- Restore ingredient highlighting logic

### Testing

- Rewrite all tests in `timer-keywords-config.test.ts`
- Remove false positive assertions on non-existent `keywords` property
- Add integration tests for ingredients + timers together

### Seeding

- Fix property references in `seed-config.ts`
- Update comparison logic to use all three arrays
- Test sync behavior with default file changes

### Translation Keys

Required i18n keys for timer keywords UI:

- `settings.admin.contentDetection.timerKeywords.title`
- `settings.admin.contentDetection.timerKeywords.subtitle`
- `settings.admin.contentDetection.timerKeywords.enableToggle`
- `settings.admin.contentDetection.timerKeywords.hoursLabel`
- `settings.admin.contentDetection.timerKeywords.minutesLabel`
- `settings.admin.contentDetection.timerKeywords.secondsLabel`
- `settings.admin.contentDetection.timerKeywords.placeholder`
- `settings.admin.contentDetection.timerKeywords.description`

All must exist in: en, de-formal, de-informal, fr, nl
