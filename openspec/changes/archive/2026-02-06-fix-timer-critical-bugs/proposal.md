# Change: Fix Timer Critical Bugs and Regressions

## Why

The timer feature implementation (PR #251 and fix-timer-feature-pr251) has **critical architectural flaws** that make it completely non-functional. A deep code review revealed:

### Critical Blocking Issues

1. **Complete Schema/UI Data Structure Mismatch** (SEVERITY: BLOCKING)
   - Database schema expects categorized keywords: `{ hours: [], minutes: [], seconds: [] }`
   - UI component expects flat array: `{ keywords: [] }`
   - Default config file uses categorized structure
   - Query hook returns wrong structure
   - Parser receives undefined data
   - **Result**: Feature is completely broken end-to-end

2. **Parser Integration Broken** (SEVERITY: BLOCKING)
   - `SmartInstruction` passes `timerKeywords.keywords` (undefined) to parser
   - Parser expects `{ hours, minutes, seconds }` structure
   - **Result**: Timer detection always uses English defaults, ignoring admin config

3. **Seeding Logic References Non-Existent Properties** (SEVERITY: HIGH)
   - `seed-config.ts` references `existing.keywords` which doesn't exist in schema
   - **Result**: Config updates silently fail or crash

4. **All Tests Are False Positives** (SEVERITY: HIGH)
   - Tests check `result?.keywords` which doesn't exist
   - **Result**: 100% test coverage but 0% validation

5. **Ingredient Quantity Formatting Regression** (SEVERITY: HIGH)
   - Original feature: ingredient quantities displayed **bold**, UOMs in **primary color**
   - Used `parseIngredientWithDefaults` for formatting (present since beginning, updated in rc/v0.16.0 for locale-aware parsing)
   - `SmartInstruction` rewrite replaced `SmartMarkdownRenderer` but lost ingredient quantity formatting
   - **Result**: Steps no longer format ingredient quantities/UOMs (e.g., "2 cups" should show "**2** cups" with "cups" in primary color)

### Root Cause

The timer feature was implemented with **three incompatible data structures**:

- Schema uses categorized arrays (correct for parser)
- UI uses flat array (simpler but incompatible)
- Seeding assumes a non-existent structure

## What Changes

### Phase 1: Resolve Data Structure Conflict (CRITICAL)

**Decision Required**: Choose ONE data structure for the entire system. Go with option A!

**Option A: Categorized Structure (RECOMMENDED)**

```typescript
interface TimerKeywordsConfig {
  enabled: boolean;
  hours: string[];
  minutes: string[];
  seconds: string[];
  isOverridden: boolean;
}
```

- ✅ Matches existing schema
- ✅ Parser already expects this format
- ✅ Better type safety
- ✅ Explicit multilingual categorization
- ⚠️ Requires UI with three text fields

**Option B: Flat Structure**

```typescript
interface TimerKeywordsConfig {
  enabled: boolean;
  keywords: string[];
  isOverridden: boolean;
}
```

- ✅ Simpler UI (one text field)
- ❌ Requires schema migration
- ❌ Parser needs auto-detection logic
- ❌ Loses explicit categorization

**This proposal implements Option A (categorized)** as it requires fewer changes and maintains type safety.

### Phase 2: Fix All Affected Components

1. **Update Timer Keywords Editor UI**
   - Replace single `keywords` field with three fields: `hours`, `minutes`, `seconds`
   - Update props interface to match `TimerKeywordsConfig` schema
   - Fix validation logic to check all three arrays

2. **Fix Query Hook**
   - Return correct structure matching schema
   - Remove non-existent `keywords` property

3. **Fix SmartInstruction Component**
   - Pass categorized keywords to parser: `{ hours: ..., minutes: ..., seconds: ... }`
   - Add error boundaries for missing config
   - Add type guards

4. **Fix Seeding Logic**
   - Update comparison to use `hours`, `minutes`, `seconds` instead of `keywords`
   - Fix sync functions

5. **Rewrite All Tests**
   - Test actual schema properties (`hours`, `minutes`, `seconds`)
   - Remove false positive assertions

6. **Fix Admin UI Integration**
   - Pass correct structure from context to editor
   - Update mutation handler type signatures

### Phase 3: Restore Ingredient Quantity Formatting

1. **Understand Original Implementation**
   - `rc/v0.16.0` used `SmartMarkdownRenderer` for all steps
   - Ingredient quantity formatting: quantity **bold**, UOM in **primary color**
   - Uses `parseIngredientWithDefaults` from `lib/helpers.ts` (locale-aware since rc/v0.16.0)

2. **Integrate with SmartInstruction**
   - Parse ingredient quantities using `parseIngredientWithDefaults`
   - Format quantity as bold, UOM in primary color
   - Parse timers using existing logic
   - Merge both into rendered output without conflicts

3. **Add Tests**
   - Test ingredient quantity formatting works (bold quantity, colored UOM)
   - Test timer detection works
   - Test both features work together (e.g., "Simmer 2 cups tomatoes for 20 minutes")
   - Test locale-aware unit parsing (German, French, Dutch units)

### Additional Fixes

4. **Optimize Timer Tick Loop**
   - Only run when timers are active
   - Add `hasRunningTimers` check

5. **Add Missing Translation Keys**
   - Verify all i18n keys exist in locale files
   - Add missing keys for timer keywords UI

6. **Add Error Handling**
   - Null/undefined checks in SmartInstruction
   - Graceful degradation when config unavailable

## Impact

- **Affected specs**: recipe-timers (new capability)
- **Affected code**:
  - `server/db/zodSchemas/server-config.ts` - Schema already correct, no changes
  - `config/timer-keywords.default.json` - Already correct, no changes
  - `app/(app)/settings/admin/components/timer-keywords-editor.tsx` - MAJOR REWRITE
  - `hooks/config/use-timer-keywords-query.ts` - Fix return type
  - `app/(app)/settings/admin/components/content-detection-card.tsx` - Fix props
  - `app/(app)/settings/admin/context.tsx` - Fix type usage
  - `components/recipe/smart-instruction.tsx` - Fix parser call + restore ingredients
  - `server/startup/seed-config.ts` - Fix property references
  - `__tests__/server/db/repositories/timer-keywords-config.test.ts` - Rewrite all tests
  - `components/timer-dock.tsx` - Optimize tick loop
  - `i18n/messages/*/settings.json` - Add missing keys

- **Breaking Changes**: None (feature doesn't work currently)
- **Migration Required**: None (no data in production yet)
- **Risk**: Medium - extensive changes but restoring to working state
- **Timeline**: 4-6 hours implementation + testing

## Dependencies

- Blocks: PR #251 merge
- Depends on: None
- Related: fix-timer-feature-pr251 (supersedes portions of that proposal)

## Answered Questions

1. ✅ **Ingredient quantity formatting**: Uses `parseIngredientWithDefaults` from `lib/helpers.ts`. Quantities are **bold**, UOMs in **primary color**. Feature present since beginning, updated for locale-aware parsing in rc/v0.16.0.
2. ✅ **Timer + Ingredient overlap**: If text is "Simmer 2 cups tomatoes for 20 minutes", both should work: "**2** cups" (bold quantity, colored UOM) + timer chip for "20 minutes". No conflicts - they format different text segments.
3. ✅ **useAutoHide hook**: Confirmed implemented in `hooks/auto-hide.tsx`, used by add-grocery-button, timer-dock, floating-recipe-chip, navbar. No changes needed.
