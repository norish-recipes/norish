# Implementation Tasks (TDD Approach)

This implementation follows Test-Driven Development: write tests first, then implement to make them pass. All new logic must have 100% test coverage.

## 1. Package Upgrade and Discovery

- [ ] 1.1 Update `package.json` to use `parse-ingredient` v2.0.1
- [ ] 1.2 Run `pnpm install` and verify successful installation
- [ ] 1.3 Create exploration test file to document v2 output format and field names
- [ ] 1.4 Document v2 field name mapping (v1 => v2) in code comments
- [ ] 1.5 Review v2 changelog for breaking changes
- [ ] 1.6 Update TypeScript type imports for parse-ingredient

## 2. TDD: Unit Form Selection Logic (Tests First)

Write tests BEFORE implementation. Target: 100% coverage of selection logic.

- [ ] 2.1 Create `__tests__/lib/unit-form-selector.test.ts` with failing tests:
  - [ ] Test: quantity > 1 returns plural form ("2 grams" => "grams")
  - [ ] Test: quantity = 1 returns singular form ("1 gram" => "gram")
  - [ ] Test: quantity < 1 returns singular form ("0.5 cup" => "cup")
  - [ ] Test: quantity = 0 returns singular form
  - [ ] Test: quantity = null/undefined returns singular form
  - [ ] Test: quantity = 1.5 returns plural form (> 1)
  - [ ] Test: quantity = 1.0 returns singular form (exactly 1)
  - [ ] Test: fallback to base unit when plural unavailable
  - [ ] Test: fallback to base unit when singular unavailable
- [ ] 2.2 Create `lib/unit-form-selector.ts` implementing `selectUnitForm(quantity, unitInfo)` to pass tests
- [ ] 2.3 Verify 100% coverage with `pnpm test:coverage`

## 3. TDD: Updated parseIngredientWithDefaults (Tests First)

- [ ] 3.1 Update `__tests__/helpers.test.ts` with new tests for v2 behavior:
  - [ ] Test: v2 field names are used in output
  - [ ] Test: plural unit returned for quantity > 1
  - [ ] Test: singular unit returned for quantity = 1
  - [ ] Test: singular unit returned for quantity ≤ 1
  - [ ] Test: handles missing plural gracefully
  - [ ] Test: German units parse correctly ("500 g Mehl")
  - [ ] Test: Dutch units still work ("2 eetlepels olie")
  - [ ] Test: mixed-language parsing works
- [ ] 3.2 Update `lib/helpers.ts::parseIngredientWithDefaults()` to pass new tests
- [ ] 3.3 Integrate `selectUnitForm()` into parsing logic
- [ ] 3.4 Verify all tests pass

## 4. TDD: Ingredient Parser Updates (Tests First)

- [ ] 4.1 Create/update `__tests__/server/parser/parsers/ingredients.test.ts`:
  - [ ] Test: parseIngredients returns v2 field structure
  - [ ] Test: unit field contains grammatically correct form
  - [ ] Test: backward compatibility with existing data structures
- [ ] 4.2 Update `server/parser/parsers/ingredients.ts::parseIngredients()` to pass tests
- [ ] 4.3 Update `ParsedIngredient` interface to reflect new field structure
- [ ] 4.4 Verify tests pass

## 5. TDD: German UOM Integration (Tests First)

- [ ] 5.1 Create `__tests__/config/german-units.test.ts`:
  - [ ] Test: German units JSON is valid and parseable
  - [ ] Test: All required fields present (short, plural, alternates)
  - [ ] Test: No duplicate keys with existing units
  - [ ] Test: Common German units recognized ("EL", "TL", "g", "kg", "ml", "l")
  - [ ] Test: German alternates work ("esslöffel" => "EL")
  - [ ] Test: Parsing "2 EL Öl" extracts correct unit
  - [ ] Test: Parsing "500 g Mehl" extracts correct unit
  - [ ] Test: Parsing "1 Prise Salz" extracts correct unit
- [ ] 5.2 Add German units to `config/units.default.json`
- [ ] 5.3 Verify all German unit tests pass

## 6. TDD: Measurement System Detection (Tests First)

- [ ] 6.1 Update `__tests__/lib/determine-recipe-system.test.ts`:
  - [ ] Test: German metric units detected as "metric"
  - [ ] Test: v2 field names work with system detection
  - [ ] Test: Mixed German/English units handled correctly
- [ ] 6.2 Update `lib/determine-recipe-system.ts` to use v2 field names
- [ ] 6.3 Verify tests pass

## 7. Field Name Migration (All ~23 Usages)

Update each file, ensuring existing tests still pass. Add tests where missing.

- [ ] 7.1 Update `lib/determine-recipe-system.ts` (line 106)
- [ ] 7.2 Update `lib/grocery-grouping.ts` (lines 40-41)
  - [ ] Add test for grocery grouping with v2 fields if missing
- [ ] 7.3 Update `server/ai/features/recipe-extraction/normalizer.ts` (line 155)
- [ ] 7.4 Update `server/trpc/routers/groceries/groceries.ts` (line 260)
- [ ] 7.5 Update `server/importers/mealie-parser.ts` (lines 463, 505, 506)
  - [ ] Verify `__tests__/importers/mealie-parser.test.ts` covers v2 fields
- [ ] 7.6 Update `server/importers/tandoor-parser.ts` (lines 139, 140)
  - [ ] Verify importer tests cover v2 fields
- [ ] 7.7 Update `server/importers/parser-helpers.ts` (line 187)
- [ ] 7.8 Update `hooks/groceries/use-groceries-mutations.ts` (lines 79, 127, 212, 245, 256, 274, 296)
  - [ ] Update `__tests__/hooks/groceries/use-groceries-mutations.test.ts` for v2 fields
- [ ] 7.9 Update `components/recipes/ingredient-input.tsx` (line 95)
- [ ] 7.10 Update test files: `__tests__/helpers.test.ts` (line 68)
- [ ] 7.11 Update test mocks: `__tests__/mocks/helpers.ts` (lines 8, 18)
- [ ] 7.12 Verify no remaining usages with: `rg -n "unitOfMeasure"`

## 8. Type Definition Updates

- [ ] 8.1 Update `types/dto/ingredient.d.ts` if needed
- [ ] 8.2 Search and update all TypeScript types referencing old field names
- [ ] 8.3 Ensure no `@ts-ignore` or type suppression used (per project conventions)
- [ ] 8.4 Run `pnpm typecheck` to verify no type errors

## 9. Integration Tests

- [ ] 9.1 Create `__tests__/integration/ingredient-parsing.test.ts`:
  - [ ] Test: Full parsing flow from raw string to stored format
  - [ ] Test: Recipe import with German ingredients
  - [ ] Test: Grocery list generation with plural/singular units
- [ ] 9.2 Test backward compatibility with existing stored ingredients
- [ ] 9.3 Verify all integration tests pass

## 10. Validation and Quality Assurance

- [ ] 10.1 Run `pnpm test` - all tests must pass
- [ ] 10.2 Run `pnpm test:coverage` - verify 100% coverage on new logic:
  - [ ] `lib/unit-form-selector.ts` - 100%
  - [ ] New code in `lib/helpers.ts` - 100%
  - [ ] New code in `server/parser/parsers/ingredients.ts` - 100%
- [ ] 10.3 Run `pnpm lint` and fix any issues
- [ ] 10.4 Run `pnpm format:check` and fix formatting
- [ ] 10.5 Run `pnpm build` and ensure successful build
- [ ] 10.6 Verify no console.log statements added (use logger instead)
- [ ] 10.7 Update `tsdown.config.ts` if bundling config changes needed (line 63)

## 11. Final Review

- [ ] 11.1 Review all changed files for completeness
- [ ] 11.2 Ensure all ~23 usages of old field names updated
- [ ] 11.3 Confirm German units JSON is valid and complete
- [ ] 11.4 Verify existing recipes still display correctly
- [ ] 11.5 Manual test: UI display in all locales (en, nl, de-formal, de-informal, fr)
- [ ] 11.6 Test real recipe import from popular German cooking site (e.g., chefkoch.de)

## Coverage Requirements

| Module                                            | Required Coverage               |
| ------------------------------------------------- | ------------------------------- |
| `lib/unit-form-selector.ts`                       | 100%                            |
| `lib/helpers.ts` (new code)                       | 100%                            |
| `server/parser/parsers/ingredients.ts` (new code) | 100%                            |
| German UOM parsing logic                          | 100%                            |
| Field migration changes                           | Covered by existing + new tests |
