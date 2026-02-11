# Change: Update Ingredient Parsing with Plural/Short Name Support and German UOMs

## Why

The current ingredient parsing implementation uses `parse-ingredient` v1.3.3, which doesn't expose plural and short name variations for units of measurement. This results in grammatically awkward displays like "450 gram" instead of "450 grams". Additionally, a community member has contributed a comprehensive German UOM list that should be integrated.

**Key insight from analysis**: The codebase does NOT re-parse for display (verified in `ingredient-list.tsx:59`). Units are displayed exactly as stored. This is the correct architecture - we just need to store the grammatically correct form at parse time.

## What Changes

- **BREAKING**: Update `parse-ingredient` package from v1.3.3 to v2.0.1
- **BREAKING**: Migrate from v1 field names (`unitOfMeasureID`, `unitOfMeasure`) to v2 field names throughout codebase (~23 usages)
- Add smart unit form selection at parse time: plural when quantity > 1, singular when quantity = 1
- Store grammatically correct unit forms in database (no re-parsing needed for display)
- Add German UOM list to default units configuration (merged with existing Dutch/English units)

## Impact

- Affected specs:
  - `ingredient-parsing` (new capability)
  - `unit-configuration` (new capability)
- Affected code:
  - `lib/helpers.ts` - parseIngredientWithDefaults function
  - `server/parser/parsers/ingredients.ts` - ingredient parsing logic
  - `lib/determine-recipe-system.ts` - unit field name updates
  - `lib/grocery-grouping.ts` - grocery unit handling
  - `config/units.default.json` - add German UOMs
  - `hooks/groceries/use-groceries-mutations.ts` - 7 usages
  - `components/recipes/ingredient-input.tsx` - input component
  - Plus importers, AI features, and test files (~23 total locations)
- Database: No schema changes. New ingredients stored with correct forms; existing data unchanged.
- User experience: Improved readability ("450 grams" instead of "450 gram")

## Breaking Changes

1. **Field name migration**: All code using `unitOfMeasureID` and `unitOfMeasure` must migrate to v2 field names
2. **Package version**: `parse-ingredient` v1.3.3 => v2.0.1 may have API changes
3. **Display format**: New parses will show plural/singular correctly (existing stored data remains unchanged)

## Migration Strategy

1. Update package.json dependency
2. Inspect v2 to identify exact field name changes
3. Update all ~23 usages systematically
4. Add unit form selection logic based on quantity
5. Add German UOMs to units.default.json
6. Test with existing recipes to ensure backward compatibility
