# Implementation Tasks

## 1. Code Quality & Standards Fixes

- [x] 1.1 Remove all AI-generated comments from timer-chip.tsx
- [x] 1.2 Remove duplicate interface definition in smart-instruction.tsx (lines 9-13)
- [x] 1.3 Reorganize imports in smart-instruction.tsx (move parseTimerDurations and useTimersEnabledQuery to top)
- [x] 1.4 Remove unused uuid import from smart-instruction.tsx
- [x] 1.5 Remove unnecessary comment in use-timers-enabled-query.ts:15
- [x] 1.6 Add proper client-side logging using createClientLogger() in timer components
- [x] 1.7 Remove design_docs/timer_feature.md file
- [x] 1.8 Fix EOF formatting in all modified JSON files (add newline at end)

## 2. Icon Library Migration

- [x] 2.1 Replace lucide-react imports with @heroicons/react/24/solid in timer-chip.tsx
- [x] 2.2 Replace lucide-react imports with @heroicons/react/24/solid in timer-dock.tsx
- [x] 2.3 Remove lucide-react from package.json dependencies
- [x] 2.4 Run pnpm install to update lockfile

## 3. Critical Bug Fixes

- [x] 3.1 Fix SmartInstruction component to properly render markdown (integrate SmartMarkdownRenderer)
- [x] 3.2 Remove timersEnabled field from content-indicators.default.json

## 4. Timer Detection Configuration System

- [x] 4.1 Create config/timer-keywords.default.json with structure:
  - [x] 4.1.1 `enabled` field (boolean, default: true)
  - [x] 4.1.2 `keywords` array with multilingual time unit keywords
  - [x] 4.1.3 Include EN, DE, FR, NL defaults
  - [x] 4.1.4 Add comprehensive keyword coverage (minute/min/mins, hour/hr/hrs, second/sec/secs variants)
- [x] 4.2 Create TimerKeywordsSchema in server/db/zodSchemas/server-config.ts:
  - [x] 4.2.1 Include `enabled`, `keywords`, and `isOverridden` fields
  - [x] 4.2.2 Create TimerKeywordsInputSchema (omit isOverridden)
  - [x] 4.2.3 Follow pattern from PromptsConfigSchema
- [x] 4.3 Add getTimerKeywords() function in server/config/server-config-loader.ts:
  - [x] 4.3.1 Load from DB if exists
  - [x] 4.3.2 Fall back to default if not overridden
  - [x] 4.3.3 Merge defaults with DB config when isOverridden=false
- [x] 4.4 Create tRPC procedure config.timerKeywords in server/trpc/routers/config/procedures.ts
- [x] 4.5 Create hooks/config/use-timer-keywords-query.ts hook
- [x] 4.6 Add updateTimerKeywords mutation to hooks/admin/use-admin-mutations.ts:
  - [x] 4.6.1 Set isOverridden=true when user saves custom config
  - [x] 4.6.2 Invalidate timer keywords query on success
- [x] 4.7 Update timer-parser.ts to accept keywords array parameter
- [x] 4.8 Update SmartInstruction to pass configured keywords to parser
- [x] 4.9 Add comprehensive tests for keyword-based parsing

## 5. Admin UI for Timer Keywords (with isOverridden pattern)

- [x] 5.1 Add timer keywords section to content-detection-card.tsx
- [x] 5.2 Add enable/disable toggle for timer feature
- [x] 5.3 Add JsonEditor for timer keywords (similar to content indicators)
- [x] 5.4 Display isOverridden indicator (show when using custom vs default config)
- [x] 5.5 Add "Reset to Defaults" button (sets isOverridden=false)
- [x] 5.6 Add i18n keys to settings.json:
  - [x] 5.6.1 timerKeywords.title
  - [x] 5.6.2 timerKeywords.subtitle
  - [x] 5.6.3 timerKeywords.description
  - [x] 5.6.4 timerKeywords.enabled.title/description
  - [x] 5.6.5 timerKeywords.resetToDefaults (button label)
  - [x] 5.6.6 timerKeywords.usingDefaults / usingCustom (status indicators)
- [x] 5.7 Wire up mutation to save timer keywords config
- [x] 5.8 Implement reset functionality that clears DB entry or sets isOverridden=false

## 6. Translation Cleanup

- [x] 6.1 Check if "done" translation already exists in common.json
- [x] 6.2 Remove duplicate timer.done and timer.done_action keys (use single key)
- [x] 6.3 Update timer-dock.tsx to use simplified translation key
- [x] 6.4 Verify all locale files have consistent structure

## 7. State Management Safeguards

- [x] 7.1 Add null check safeguard in tick() function for edge case handling
- [x] 7.2 Add logging when edge case occurs (running timer with null lastTickAt)
- [x] 7.3 Update timer tests to cover edge case scenarios

## 8. Testing & Validation

- [x] 8.1 Unit tests - Timer Parser:
  - [x] 8.1.1 Run existing timer-parser.test.ts tests
  - [x] 8.1.2 Add tests for keyword-based timer parsing
  - [x] 8.1.3 Test with different keyword configurations (custom keywords)
  - [x] 8.1.4 Test case-insensitive matching
- [x] 8.2 Unit tests - Timer Store:
  - [x] 8.2.1 Run stores/timers.test.ts tests
  - [x] 8.2.2 Test edge case scenarios (null lastTickAt)
- [x] 8.3 DB Integration tests - Timer Keywords Config:
  - [x] 8.3.1 Test saving timer keywords to DB
  - [x] 8.3.2 Test loading timer keywords from DB
  - [x] 8.3.3 Test isOverridden flag behavior (true = use DB, false = use defaults)
  - [x] 8.3.4 Test that updating defaults updates user config when isOverridden=false
  - [x] 8.3.5 Test that updating defaults doesn't affect user config when isOverridden=true
  - [x] 8.3.6 Test reset to defaults functionality
  - [x] 8.3.7 Follow pattern from existing config integration tests
- [x] 8.4 Manual tests - Timer Detection:
  - [x] 8.4.1 Verify markdown renders correctly in active steps
  - [x] 8.4.2 Verify timers work with EN/DE/FR/NL keywords
  - [x] 8.4.3 Verify custom keywords work (add custom time unit like "dakika")
  - [x] 8.4.4 Verify timer enable/disable toggle works
- [x] 8.5 Manual tests - Admin UI:
  - [x] 8.5.1 Verify admin can edit timer keywords
  - [x] 8.5.2 Verify "Reset to Defaults" button works
  - [x] 8.5.3 Verify isOverridden indicator updates correctly
  - [x] 8.5.4 Verify saving custom config sets isOverridden=true
- [x] 8.6 Full validation:
  - [x] 8.6.1 Run full test suite: pnpm test:run
  - [x] 8.6.2 Run linter: pnpm lint
  - [x] 8.6.3 Run type check: pnpm build

## 9. Code Review & Documentation

- [x] 9.1 Self-review all changes against project conventions
- [x] 9.2 Verify all reviewer comments from PR #251 are addressed
- [x] 9.3 Update PR description with changes made
- [x] 9.4 Request re-review from mikevanes
