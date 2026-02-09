# Change: Fix Timer Feature Issues from PR #251

## Why

PR #251 introduces an interactive timer feature for recipe steps, which is a valuable addition to Norish. However, the initial implementation has several issues identified during code review that need to be addressed before merging:

1. **Code Quality Issues**: AI-generated comments, duplicate interfaces, and improper import organization
2. **Critical Bugs**: Markdown rendering broken for active steps, wrong configuration location
3. **Internationalization**: Timer parser only works for English recipes
4. **Project Standards Violations**: Uses lucide-react instead of HeroIcons, missing proper logging
5. **Translation Issues**: Duplicate i18n keys and unnecessary translations

## What Changes

### Code Quality & Standards

- Remove all AI-generated comments and code artifacts
- Fix duplicate interface definitions in `components/recipe/smart-instruction.tsx`
- Reorganize imports to match project conventions (types first, sorted alphabetically)
- Replace lucide-react icons with @heroicons/react throughout
- Remove unused imports (uuid in smart-instruction.tsx)
- Add proper logging using `createClientLogger()` for client-side code

### Critical Bug Fixes

- **CRITICAL**: Fix markdown rendering regression in steps-list.tsx - `SmartInstruction` must render markdown properly for active steps
- Remove `timersEnabled` from `content-indicators.default.json` (doesn't belong there)
- Add proper timer configuration structure with:
  - `enabled` field (default: true)
  - `keywords` array for time unit detection
- Place timer config alongside content indicators in admin UI

### Timer Detection Configuration

- Add configurable timer detection keywords (similar to content indicators pattern)
- Create `config/timer-keywords.default.json` with default keywords for:
  - English: ["minute", "minutes", "min", "mins", "hour", "hours", "hr", "hrs", "second", "seconds", "sec", "secs"]
  - German: ["minute", "minuten", "min", "stunde", "stunden", "std", "sekunde", "sekunden", "sek"]
  - French: ["minute", "minutes", "min", "heure", "heures", "h", "seconde", "secondes", "sec"]
  - Dutch: ["minuut", "minuten", "min", "uur", "uren", "u", "seconde", "seconden", "sec"]
- Add admin UI in Content Detection section for editing timer keywords
- Update timer parser to use configured keywords instead of hardcoded patterns

### Translation Cleanup

- Remove duplicate timer translation keys (`timer.done` and `timer.done_action` are identical)
- Reuse existing "done" translation from common i18n keys if available
- Ensure all locale files have consistent structure

### Code Organization

- Remove design_docs/timer_feature.md (design docs shouldn't be committed in feature PRs)
- Fix EOF formatting issues in JSON files
- Ensure consistent code formatting throughout

### State Management

- Add safeguards in timer tick loop for edge cases where running timer has null `lastTickAt`

## Impact

- **Affected specs**: recipe-timers (new capability)
- **Affected code**:
  - `components/recipe/smart-instruction.tsx` - Major refactoring
  - `components/recipe/timer-chip.tsx` - Icon library replacement, cleanup
  - `components/timer-dock.tsx` - Icon library replacement
  - `lib/timer-parser.ts` - Use configurable keywords instead of hardcoded patterns
  - `config/content-indicators.default.json` - Remove timersEnabled field
  - `config/timer-keywords.default.json` - NEW: Default timer detection keywords
  - `server/config/server-config-loader.ts` - Add timer config loading
  - `server/db/zodSchemas/server-config.ts` - Add TimerKeywordsSchema
  - `server/trpc/routers/config/procedures.ts` - Add timerKeywords endpoint
  - `app/(app)/settings/admin/components/content-detection-card.tsx` - Add timer keywords editor
  - `hooks/config/use-timer-keywords-query.ts` - NEW: Hook for timer config
  - `hooks/admin/use-admin-mutations.ts` - Add updateTimerKeywords mutation
  - `i18n/messages/*/common.json` - Cleanup duplicate keys
  - `i18n/messages/*/settings.json` - Add timer keywords UI labels
  - `stores/timers.ts` - Add safeguards
  - `package.json` - Remove lucide-react dependency

- **Breaking Changes**: None (feature is new and disabled by default in original PR, will be enabled by default after fix)
- **Migration Required**: None
