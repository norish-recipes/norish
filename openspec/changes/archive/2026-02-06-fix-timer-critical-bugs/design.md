# Design: Timer Critical Bugs Fix

## Problem Analysis

### The Three Incompatible Structures

The timer feature has a **fundamental data flow problem**:

```
┌─────────────────────────────────────────────────────────┐
│ Database Schema (Zod)                                   │
│ TimerKeywordsSchema = {                                 │
│   enabled: boolean,                                     │
│   hours: string[],      ← Categorized by unit type     │
│   minutes: string[],                                    │
│   seconds: string[],                                    │
│   isOverridden: boolean                                 │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Default Config File (JSON)                              │
│ {                                                       │
│   "enabled": true,                                      │
│   "hours": ["hour", "hours", "hr", ...],   ← MATCHES   │
│   "minutes": ["minute", "minutes", ...],                │
│   "seconds": ["second", "seconds", ...]                 │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ tRPC Procedure (Returns)                                │
│ TimerKeywordsConfig from DB                  ← CORRECT  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Query Hook (BROKEN)                                     │
│ timerKeywords: data ?? {                                │
│   enabled: true,                                        │
│   keywords: [],        ← WRONG! Property doesn't exist  │
│   isOverridden: false                                   │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ UI Component (BROKEN)                                   │
│ interface TimerKeywordsEditorProps {                    │
│   enabled: boolean,                                     │
│   keywords: string[]  ← Expects flat array              │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ SmartInstruction (BROKEN)                               │
│ parseTimerDurations(text, timerKeywords.keywords)       │
│                                  ^^^^^^^^^ undefined    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Parser (Expects)                                        │
│ keywords?: {                                            │
│   hours?: string[],                                     │
│   minutes?: string[],                                   │
│   seconds?: string[]                                    │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
```

**Result**: Every layer expects a different structure. Nothing works.

## Solution Architecture

### Decision: Keep Categorized Structure

**Rationale**:

1. Schema is already correct and deployed
2. Parser already expects this format
3. Default config file already correct
4. Less code to change (UI only)
5. Better type safety and clarity

### Data Flow (After Fix)

```
Database Schema (hours[], minutes[], seconds[])
    ↓
tRPC Procedure (returns schema as-is)
    ↓
Query Hook (returns correct structure)
    ↓
Admin Context (passes correct structure)
    ↓
UI Component (three text fields)
    ↓
SmartInstruction (passes { hours, minutes, seconds })
    ↓
Parser (receives expected format) ✓
```

## Component Changes

### 1. Timer Keywords Editor UI

**Before** (Broken):

```typescript
interface TimerKeywordsEditorProps {
  enabled: boolean;
  keywords: string[];  // WRONG
  onUpdate: (config: { enabled: boolean; keywords: string[] }) => ...
}

// Single textarea: "minute, minutes, hour, hours"
```

**After** (Fixed):

```typescript
interface TimerKeywordsEditorProps {
  enabled: boolean;
  hours: string[];
  minutes: string[];
  seconds: string[];
  onUpdate: (config: TimerKeywordsInput) => ...
}

// Three textareas:
// Hours: "hour, hours, hr, hrs, h"
// Minutes: "minute, minutes, min, mins, m"
// Seconds: "second, seconds, sec, secs, s"
```

**UI Layout**:

```
┌─────────────────────────────────────────────────┐
│ Timer Detection                                 │
│ ┌───────────────────────────────┐              │
│ │ Enable Timer Detection  [✓]   │              │
│ └───────────────────────────────┘              │
│                                                 │
│ Hour Keywords                                   │
│ ┌────────────────────────────────────────────┐ │
│ │ hour, hours, hr, hrs, h, stunde, stunden   │ │
│ └────────────────────────────────────────────┘ │
│                                                 │
│ Minute Keywords                                 │
│ ┌────────────────────────────────────────────┐ │
│ │ minute, minutes, min, minuten, minuut      │ │
│ └────────────────────────────────────────────┘ │
│                                                 │
│ Second Keywords                                 │
│ ┌────────────────────────────────────────────┐ │
│ │ second, seconds, sec, sekunde, seconde     │ │
│ └────────────────────────────────────────────┘ │
│                                                 │
│ [Restore Defaults]  [Save]                     │
└─────────────────────────────────────────────────┘
```

### 2. Query Hook Fix

**Before**:

```typescript
timerKeywords: data ?? { enabled: true, keywords: [], isOverridden: false };
```

**After**:

```typescript
timerKeywords: data ?? {
  enabled: true,
  hours: [],
  minutes: [],
  seconds: [],
  isOverridden: false,
};
```

### 3. SmartInstruction Parser Call

**Before**:

```typescript
parseTimerDurations(text, timerKeywords.keywords); // undefined!
```

**After**:

```typescript
parseTimerDurations(text, {
  hours: timerKeywords.hours,
  minutes: timerKeywords.minutes,
  seconds: timerKeywords.seconds,
});
```

### 4. Seeding Logic

**Before**:

```typescript
const storedComparable = {
  enabled: existing.enabled,
  keywords: existing.keywords, // Doesn't exist!
};
```

**After**:

```typescript
const storedComparable = {
  enabled: existing.enabled,
  hours: existing.hours,
  minutes: existing.minutes,
  seconds: existing.seconds,
};
```

## Ingredient Quantity Formatting Integration

### Original Implementation (rc/v0.16.0)

Before timer feature:

- All steps used `<SmartMarkdownRenderer disableLinks={isDone} text={s.step} />`
- Ingredient quantities formatted: **quantity bold**, UOM in **primary color**
- Uses `parseIngredientWithDefaults(text, units)` from `lib/helpers.ts`
- Example: "Add 2 cups flour" => "Add **2** <span class="text-primary">cups</span> flour"

### Architecture Options

**Option 1: Sequential Parsing** (Recommended)

```typescript
// 1. Parse ingredient quantities using parseIngredientWithDefaults
const quantitySegments = parseIngredientQuantities(text, units);

// 2. Parse timer durations
const timerSegments = parseTimers(text, keywords);

// 3. Merge segments by position (non-overlapping)
const mergedSegments = mergeSegments(quantitySegments, timerSegments);

// 4. Render: markdown + formatted quantities + timer chips
```

**Option 2: Reuse SmartMarkdownRenderer**

```typescript
// Wrap SmartMarkdownRenderer with timer detection
<SmartMarkdownRenderer text={textWithTimersReplaced} />
// Replace timer matches with placeholder components
```

**Decision**: Option 1 (Sequential) - maintains separation of concerns, easier to test

### Conflict Resolution

**No conflicts by design** - they format different text:

- Ingredient quantities: "2 cups" => "**2** <span>cups</span>"
- Timer durations: "20 minutes" => `<TimerChip>20 minutes</TimerChip>`
- Full example: "Simmer **2** <span>cups</span> tomatoes for <TimerChip>20 minutes</TimerChip>"

**Rules**:

1. Timer keywords = time units only (hour, minute, second)
2. Ingredient UOMs = cooking units (cup, tablespoon, gram, etc.)
3. Zero overlap in keyword sets
4. Both features render independently

## Testing Strategy

### Unit Tests

1. **Timer Keywords Schema**
   - ✓ Valid categorized structure
   - ✗ Flat array (should fail)
   - ✓ Missing categories default to empty arrays

2. **Parser Integration**
   - ✓ Receives categorized keywords
   - ✓ Detects timers in all languages
   - ✓ Falls back to defaults when config empty

3. **Seeding Logic**
   - ✓ Seeds from default file
   - ✓ Respects isOverridden flag
   - ✓ Updates when file changes

4. **UI Component**
   - ✓ Renders three text fields
   - ✓ Parses comma-separated values
   - ✓ Saves categorized structure

5. **Ingredient + Timer Integration**
   - ✓ Both features work independently
   - ✓ Both work together
   - ✓ No rendering conflicts

### Integration Tests

1. **End-to-End Config Flow**
   - Admin updates keywords => Saves to DB => Recipe step detects timer

2. **Multi-language Detection**
   - Recipe in German => German keywords detected
   - German UOMs formatted correctly (e.g., "200 g" => "**200** g")

3. **Ingredient Quantity Formatting**
   - Recipe with quantities => Steps format quantities bold, UOMs colored
   - Locale-aware parsing (French "2 cuillères" works same as English "2 tablespoons")

## Performance Considerations

### Timer Tick Optimization

**Before**:

```typescript
useEffect(() => {
  const interval = setInterval(tick, 1000); // Always running!
  return () => clearInterval(interval);
}, [tick]);
```

**After**:

```typescript
const hasRunningTimers = timers.some((t) => t.status === "running");
useEffect(() => {
  if (!hasRunningTimers) return; // Skip if no active timers
  const interval = setInterval(tick, 1000);
  return () => clearInterval(interval);
}, [hasRunningTimers, tick]);
```

**Impact**: Saves CPU when no timers active (most of the time)

## Rollout Plan

1. **Phase 1**: Fix data structures (all layers)
2. **Phase 2**: Restore ingredient highlighting
3. **Phase 3**: Optimize performance
4. **Phase 4**: Add comprehensive tests
5. **Phase 5**: Validate in staging
6. **Phase 6**: Merge to main

## Risk Mitigation

| Risk                              | Likelihood | Impact | Mitigation                            |
| --------------------------------- | ---------- | ------ | ------------------------------------- |
| Breaking existing config          | Low        | High   | Schema unchanged, only UI fixed       |
| Ingredient highlighting conflicts | Medium     | Medium | Clear priority rules, extensive tests |
| Translation keys missing          | Low        | Low    | Verify all keys exist before deploy   |
| Performance regression            | Low        | Medium | Benchmark timer tick loop             |

## Success Criteria

- [ ] All unit tests pass (rewritten correctly)
- [ ] Integration tests pass
- [ ] Admin can configure timer keywords in all three categories
- [ ] Parser detects timers in German, French, Dutch, English
- [ ] Ingredient highlighting works in recipe steps
- [ ] No timer tick when no active timers
- [ ] All TypeScript types align across layers
- [ ] No console errors in browser
