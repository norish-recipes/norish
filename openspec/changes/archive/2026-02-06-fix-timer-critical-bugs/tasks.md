# Tasks: Fix Timer Critical Bugs

Implementation tasks ordered by dependency and user-visible impact.

## Phase 1: Fix Data Structure Mismatch (CRITICAL - BLOCKING)

- [x] **Fix use-timer-keywords-query.ts default value**
  - Replace `{ keywords: [] }` with `{ hours: [], minutes: [], seconds: [] }`
  - Update return type to match `TimerKeywordsConfig`
  - Add JSDoc comment explaining structure
  - **Validation**: TypeScript compiles without errors, query returns correct structure

- [x] **Rewrite timer-keywords-editor.tsx component**
  - Replace single `keywords` prop with `hours`, `minutes`, `seconds` props
  - Create three separate Textarea fields (one per category)
  - Update `handleTextChange` to track which field changed
  - Update `handleSave` to send categorized structure
  - Add validation: at least one keyword in one category when enabled
  - **Validation**: Component accepts `TimerKeywordsConfig` type, renders three fields

- [x] **Fix content-detection-card.tsx props**
  - Pass `timerKeywords.hours`, `timerKeywords.minutes`, `timerKeywords.seconds` separately
  - Update onUpdate callback to handle categorized structure
  - **Validation**: No TypeScript errors, props match editor interface

- [x] **Fix admin context.tsx type usage**
  - Ensure `updateTimerKeywordsConfig` accepts `TimerKeywordsInput`
  - Verify type flows correctly from editor => context => mutation
  - **Validation**: Types align end-to-end, no `any` casts needed

- [x] **Fix SmartInstruction parser call**
  - Change `parseTimerDurations(text, timerKeywords.keywords)` to pass categorized object
  - Pass `{ hours: timerKeywords.hours, minutes: timerKeywords.minutes, seconds: timerKeywords.seconds }`
  - Add null/undefined checks before accessing properties
  - Add error boundary for missing config
  - **Validation**: Parser receives correct structure, no runtime errors, timers detect in multiple languages

- [x] **Fix seed-config.ts property references**
  - In `syncTimerKeywords()`, replace `keywords` with `hours`, `minutes`, `seconds`
  - Update `storedComparable` to include all three arrays
  - Update `fileComparable` to include all three arrays
  - **Validation**: Seeding runs without errors, compares correct properties

## Phase 2: Fix Tests (HIGH PRIORITY)

- [x] **Rewrite timer-keywords-config.test.ts**
  - Replace all `result?.keywords` assertions with `hours`, `minutes`, `seconds`
  - Test seeding with categorized structure
  - Test override behavior with all three arrays
  - Test enable/disable with categorized keywords
  - **Validation**: All tests pass, test actual schema properties

- [x] **Add integration test for parser**
  - Test categorized keywords flow: config => query => parser => detection
  - Test German, French, Dutch keyword detection
  - Test with empty arrays falls back to defaults
  - **Validation**: End-to-end timer detection works in all languages

## Phase 3: Restore Ingredient Quantity Formatting (HIGH PRIORITY)

- [x] **Understand rc/v0.16.0 implementation**
  - Review how `SmartMarkdownRenderer` formatted quantities
  - Confirm `parseIngredientWithDefaults` usage pattern
  - Document: quantity **bold**, UOM **primary color**
  - **Validation**: Understand original behavior from rc/v0.16.0

- [x] **Add ingredient quantity parsing to SmartInstruction**
  - Import `parseIngredientWithDefaults` from `lib/helpers`
  - Parse step text for ingredient quantities and UOMs
  - Create segments for quantity matches (separate from timer segments)
  - **Validation**: Quantities and UOMs identified in step text

- [x] **Format quantities and UOMs in rendered output**
  - Render quantity text with **bold** styling
  - Render UOM text with **primary color** class
  - Example: "2 cups" => `<strong>2</strong> <span className="text-primary">cups</span>`
  - **Validation**: Quantities bold, UOMs colored

- [x] **Merge quantity formatting with timer detection**
  - Combine quantity segments and timer segments
  - Sort by position in text (non-overlapping by design)
  - Ensure no conflicts (timers = time units, quantities = cooking units)
  - **Validation**: Both features work without overlap

- [x] **Integrate with markdown rendering**
  - Ensure ReactMarkdown still processes headings, links
  - Quantity formatting works inside markdown paragraphs
  - Timer chips work inside markdown paragraphs
  - **Validation**: All three features (markdown + quantities + timers) coexist

- [x] **Add tests for quantity + timer integration**
  - Test step with only quantities: "Add 2 cups flour"
  - Test step with only timers: "Bake for 20 minutes"
  - Test step with both: "Simmer 2 cups tomatoes for 20 minutes"
  - Test locale-aware units: German "200 g Mehl", French "2 cuillères"
  - **Validation**: All combinations format correctly

## Phase 4: Add Missing Translation Keys (MEDIUM PRIORITY)

- [x] **Add timer keywords UI translation keys**
  - Add to `i18n/messages/en/settings.json`:
    - `timerKeywords.title`
    - `timerKeywords.subtitle`
    - `timerKeywords.enableToggle`
    - `timerKeywords.hoursLabel`
    - `timerKeywords.hoursPlaceholder`
    - `timerKeywords.minutesLabel`
    - `timerKeywords.minutesPlaceholder`
    - `timerKeywords.secondsLabel`
    - `timerKeywords.secondsPlaceholder`
    - `timerKeywords.description`
  - **Validation**: English translations complete

- [x] **Translate to German (formal and informal)**
  - Copy English keys to `de-formal/settings.json` and `de-informal/settings.json`
  - Translate all timer keywords UI strings
  - **Validation**: German translations complete

- [x] **Translate to French**
  - Copy English keys to `fr/settings.json`
  - Translate all timer keywords UI strings
  - **Validation**: French translations complete

- [x] **Translate to Dutch**
  - Copy English keys to `nl/settings.json`
  - Translate all timer keywords UI strings
  - **Validation**: Dutch translations complete

- [x] **Verify all locale files**
  - Run `pnpm i18n:check` to verify key consistency
  - Fix any missing or extra keys
  - **Validation**: i18n check passes for all locales

## Phase 5: Performance Optimizations (MEDIUM PRIORITY)

- [x] **Optimize timer tick loop in timer-dock.tsx**
  - Calculate `hasRunningTimers` before useEffect
  - Only start interval when `hasRunningTimers === true`
  - Return early from useEffect when no running timers
  - **Validation**: Tick loop only runs when timers active, CPU usage reduced

- [x] **Add memoization to SmartInstruction parsing**
  - Wrap segment parsing in useMemo with correct dependencies
  - Avoid re-parsing on every render
  - **Validation**: Parsing only runs when text or config changes

## Phase 6: Error Handling and Edge Cases (LOW PRIORITY)

- [x] **Add null checks in SmartInstruction**
  - Check `timerKeywords` exists before accessing properties
  - Provide default empty arrays if config unavailable
  - Log warnings when config missing
  - **Validation**: No crashes when config unavailable, graceful degradation

- [x] **Add error boundary for timer feature**
  - Wrap timer components in error boundary
  - Show fallback UI on errors
  - Log errors to console
  - **Validation**: Errors don't crash entire recipe page

- [x] **Verify no TypeScript errors in timer-dock**
  - Confirm `useAutoHide` import works (confirmed at `hooks/auto-hide.tsx`)
  - Check all other imports and types
  - **Validation**: No import or type errors

## Phase 7: Final Validation (CRITICAL)

- [x] **Run all tests**
  - `pnpm test:run` - all unit tests pass
  - Verify timer tests pass with new structure
  - Verify ingredient tests pass (if any exist)
  - **Validation**: Zero test failures

- [x] **Run type checking**
  - `pnpm type-check` passes with zero errors
  - No `any` types in timer-related code
  - **Validation**: Clean TypeScript compilation

- [x] **Run linting**
  - `pnpm lint` passes
  - `pnpm format:check` passes
  - **Validation**: Code meets style standards

- [x] **Manual testing in dev environment**
  - Admin UI: Configure timer keywords in all three categories
  - Save and verify keywords persist
  - Recipe page: View step with timer (e.g., "Bake for 20 minutes")
  - Click timer chip and verify countdown starts
  - Test German recipe with German keywords
  - Verify ingredient quantity formatting works (quantity bold, UOM colored)
  - Test step with both: "Simmer 2 cups tomatoes for 20 minutes"
  - Verify locale-aware units: German "200 g", French "2 cuillères"
  - **Validation**: All features work end-to-end

- [x] **Validate OpenSpec**
  - Run `openspec validate fix-timer-critical-bugs --strict --no-interactive`
  - Fix any validation errors
  - **Validation**: OpenSpec validation passes

## Dependencies

```
Phase 1 (Data Structure Fix)
    ↓
Phase 2 (Fix Tests) + Phase 3 (Restore Ingredients)
    ↓
Phase 4 (Translations) + Phase 5 (Performance)
    ↓
Phase 6 (Error Handling)
    ↓
Phase 7 (Final Validation)
```

## Estimated Timeline

- Phase 1: 2 hours (critical path)
- Phase 2: 1 hour (parallel with Phase 3)
- Phase 3: 2 hours (parallel with Phase 2)
- Phase 4: 1 hour (parallel with Phase 5)
- Phase 5: 0.5 hours (parallel with Phase 4)
- Phase 6: 0.5 hours
- Phase 7: 1 hour

**Total: ~6-7 hours** (some phases can run in parallel)

## Success Criteria

All tasks completed AND:

- [x] Admin can configure timer keywords in three categories
- [x] Timer detection works in English, German, French, Dutch
- [x] Ingredient highlighting restored and working
- [x] Both features work together without conflicts
- [x] All tests pass (no false positives)
- [x] TypeScript compiles with zero errors
- [x] Manual testing confirms end-to-end functionality
- [x] OpenSpec validation passes
