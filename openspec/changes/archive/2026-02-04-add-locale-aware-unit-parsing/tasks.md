# Implementation Tasks

## 1. Update Units Configuration Schema

**What:** Create new TypeScript types for locale-aware unit definitions

**Files:**

- Create or update types in configuration module

**Validation:**

- TypeScript compiles without errors
- Zod schema validates locale arrays correctly

**Dependencies:** None (can start immediately)

---

## 2. Create Flattening Utility

**What:** Implement `flattenForLibrary()` function to convert locale arrays to flat format for parse-ingredient library

**Files:**

- Utility function in parsing module

**Validation:**

- Unit test verifies flattening uses first locale's forms
- Unit test verifies alternates array is preserved unchanged

**Dependencies:** Task 1 (needs new types)

---

## 3. Create Display Formatting Utility

**What:** Implement `formatUnit()` function to get locale-specific display form

**Files:**

- Utility function in display/formatting module

**Validation:**

- Unit test verifies locale matching works correctly
- Unit test verifies fallback to English works
- Unit test verifies final fallback to first available locale

**Dependencies:** Task 1 (needs new types)

---

## 4. Update Default Units Configuration File

**What:** Convert `units.default.json` to new schema with locale arrays

**Files:**

- `units.default.json` (or equivalent config file)

**Validation:**

- JSON validates against new schema
- Includes en/de/nl locales for all common units
- All current alternates are preserved

**Dependencies:** Task 1 (needs schema definition)

---

## 5. Update Units Seeding Logic

**What:** Modify database seeding to use new configuration format

**Files:**

- Database seeding/initialization code
- Migration or startup script

**Validation:**

- Fresh install seeds new format correctly
- `isOverwritten` flag logic works as expected
- Hash-based version detection works

**Dependencies:** Task 4 (needs new config file)

---

## 6. Update Ingredient Parsing Integration

**What:** Modify parsing code to use flattening utility before calling parse-ingredient library

**Files:**

- `parseIngredientWithDefaults()` or equivalent wrapper

**Validation:**

- Integration test: "500 gramm Mehl" parses to unitOfMeasureID="gram"
- Integration test: German alternate "gramm" is recognized
- Integration test: All existing tests still pass

**Dependencies:** Task 2 (needs flattening function)

---

## 7. Update Display Code

**What:** Modify ingredient display components to use formatting utility with user's locale

**Files:**

- Recipe display components
- Grocery list display components
- Any other places units are displayed

**Validation:**

- Visual test: German user sees "500 g"
- Visual test: English user sees "500 grams"
- Visual test: Dutch user sees "500 gram"
- Visual test: Unknown locale falls back to English

**Dependencies:** Task 3 (needs formatting function)

---

## 8. Update Admin UOM Management UI

**What:** Update admin panel to accept and validate new JSON schema

**Files:**

- Admin UOM configuration page/form
- Validation logic

**Validation:**

- Admin can view current configuration in new format
- Validation rejects old flat schema
- Validation accepts new locale array schema
- Saving sets `isOverwritten = true`

**Dependencies:** Task 1 (needs new schema for validation)

---

## 9. Add Integration Tests

**What:** Comprehensive end-to-end tests for full flow

**Files:**

- New test file for locale-aware parsing and display

**Tests:**

- Parse German input => display in English locale
- Parse English input => display in German locale
- Parse Dutch input => display in Dutch locale
- Unknown unit falls back gracefully

**Dependencies:** Tasks 6 and 7 (needs parsing and display working)

---

## 10. Documentation

**What:** Update documentation for new configuration format

**Files:**

- Admin documentation
- Developer documentation (if exists)

**Content:**

- How to add new locales
- Schema explanation
- Migration notes for admins with custom UOMs

**Dependencies:** All previous tasks (documents final implementation)

---

## Parallel Work Opportunities

These tasks can be worked on in parallel:

- Tasks 1, 2, 3 can run in parallel after defining types
- Tasks 4 and 8 can run in parallel
- Tasks 6 and 7 can run in parallel after their dependencies are complete

## Deployment Checklist

- [x] All unit tests passing
- [x] All integration tests passing
- [x] Visual QA in all three locales (en, de, nl)
- [x] Admin UOM panel tested with new format
- [x] Patch notes written (breaking change notice)
- [x] Fresh install tested
- [x] Upgrade from previous version tested

---

## Implementation Complete ✅

All tasks have been completed and validated. The locale-aware unit parsing feature is production-ready.
