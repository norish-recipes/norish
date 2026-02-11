# Design: Ingredient Parsing Enhancement

## Context

Norish parses ingredients from various sources (URL imports, manual entry, AI extraction). Currently using `parse-ingredient` v1.3.3, which provides basic parsing but doesn't expose unit variations (plural, short forms).

**Current architecture (verified)**:

1. Parse time: `parseIngredientWithDefaults()` => stores `unitOfMeasure` field
2. Display time: `ingredient-list.tsx:59` simply shows `it.unit` - NO re-parsing
3. This is correct! We just need to store the right form at parse time.

**Constraints:**

- ~23 locations reference `unitOfMeasure` or `unitOfMeasureID`
- Database contains existing ingredients with current unit forms
- Real-time sync requires consistent data structure

## Goals / Non-Goals

**Goals:**

- Store ingredients with grammatically correct unit forms (plural when qty > 1, singular when qty = 1)
- Upgrade to parse-ingredient v2.0.1 to access new features
- Add comprehensive German UOM support alongside existing Dutch/English units
- Maintain backward compatibility with existing stored ingredients

**Non-Goals:**

- Migrate existing database records (existing data remains as-is)
- Add user-configurable unit display preferences (future enhancement)
- Re-parse on display (current architecture is correct)

## Decisions

### Decision 1: Store Correct Form at Parse Time

**Chosen approach:** When parsing, select unit form based on quantity and store that form.

**Rationale:**

- Display component already expects correct form (`it.unit` used directly)
- No computation needed at render time
- Allows manual editing if needed
- User confirmed: "When storing store the right format. so >1 plural and == 1 singular"

**Implementation:**

```typescript
// After parsing with parse-ingredient v2
const quantity = parsed.quantity;
const unit = quantity && quantity > 1 ? parsed.unitPlural || parsed.unit : parsed.unit;
```

### Decision 2: Full Migration to v2 Field Names

**Chosen approach:** Update all ~23 usages to use v2 field names directly.

**Rationale:**

- User confirmed: "Full migration to v2 field names"
- Cleaner codebase without compatibility shims
- Single PR makes rollback easy if needed

### Decision 3: Merge German UOMs with Existing Units

**Chosen approach:** Add all German units to `units.default.json` alongside existing Dutch/English units.

**Rationale:**

- User confirmed: "Always include both see how its done for dutch"
- Supports mixed-language recipes (common in Europe)
- parse-ingredient handles multiple unit systems gracefully

## Risks / Trade-offs

### Risk 1: parse-ingredient v2 Breaking Changes

**Mitigation:**

- Review v2 changelog before implementation
- Test with comprehensive ingredient samples
- Have rollback plan (revert to v1.3.3)

### Risk 2: Old vs New Data Inconsistency

**Risk:** Existing records have old forms, new records will have correct forms.

**Mitigation:**

- Acceptable trade-off - old data remains functional
- Over time, new imports/edits will use correct forms
- No data migration needed (reduces risk)

### Risk 3: German UOM Conflicts

**Risk:** German abbreviations might conflict with Dutch (e.g., "el" = eetlepel/esslöffel).

**Mitigation:**

- parse-ingredient uses longest-match-first algorithm
- Alternates list allows both meanings
- Community contributor likely considered conflicts

## Migration Plan

**Phase 1: Package Upgrade & Discovery**

1. Update package.json: `"parse-ingredient": "2.0.1"`
2. Document v2 field names and API changes
3. Update TypeScript type definitions

**Phase 2: Code Migration**

1. Update core parsing in `lib/helpers.ts`
2. Add unit form selection logic (plural vs singular)
3. Update all ~23 usages of old field names
4. Add unit tests for new logic

**Phase 3: German UOMs**

1. Add German units to `config/units.default.json`
2. Test with German recipe samples

**Phase 4: Testing**

1. Test recipe imports, manual entry, grocery lists
2. Verify backward compatibility
3. Test all supported locales

**Rollback plan:**

- Revert package.json and code changes (single PR)
- Existing data unaffected
- Downtime: ~5 minutes

## Open Questions

1. **What are the exact field names in parse-ingredient v2?**
   - Action: Inspect package after upgrade
   - Blocker: Yes - needed for implementation

2. **Does v2 expose plural/short fields on parsed results?**
   - Action: Test with sample ingredients
   - Blocker: Yes - affects implementation approach
