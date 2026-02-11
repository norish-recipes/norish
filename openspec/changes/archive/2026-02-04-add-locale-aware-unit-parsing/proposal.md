# Change Proposal: Add Locale-Aware Unit Parsing

## Metadata

- **Change ID:** `add-locale-aware-unit-parsing`
- **Type:** Enhancement
- **Status:** Draft
- **Created:** 2026-02-03
- **Related Issue:** [#253](https://github.com/norish-recipes/norish/issues/253)

## Why

Users in different locales see incorrect or confusing unit displays because the current system uses a single display form per unit, ignoring locale-specific conventions. For example, German users importing "500 gramm Mehl" see "500 grams Mehl" (mixing German and English), and Dutch users see English abbreviations instead of their expected "gr" or "eetlepels". This breaks the localized experience and creates confusion during recipe creation and viewing.

The current units configuration stores only flat English display forms, making it impossible to provide locale-appropriate unit displays. We need to restructure the configuration to support locale-specific short and plural forms while maintaining the existing canonical ID storage that's already in production.

## Problem Statement

Users see incorrect unit forms because:

1. Can't have locale-specific alternates (German "gramm") in flat config
2. Can't display same unit differently per locale (German "g" vs English "grams")
3. Store English display forms instead of canonical IDs

### Current Behavior

```typescript
parseIngredientWithDefaults("500 g Mehl");
// Library returns: unitOfMeasureID = "gram"
// We apply English plural logic and store: unit = "grams"
// German user sees: "500 grams Mehl" ❌

parseIngredientWithDefaults("500 gramm Mehl");
// "gramm" not in config
// Result: unit = null ❌
```

## Proposed Solution

**Use English IDs as canonical keys, store locale-specific display forms as arrays.**

### New Structure

```json
{
  "gram": {
    "short": [
      { "locale": "en", "name": "g" },
      { "locale": "de", "name": "g" },
      { "locale": "nl", "name": "gr" }
    ],
    "plural": [
      { "locale": "en", "name": "grams" },
      { "locale": "de", "name": "g" },
      { "locale": "nl", "name": "gram" }
    ],
    "alternates": ["g", "gram", "grams", "gramm", "gr", "grammen"]
  },
  "tablespoon": {
    "short": [
      { "locale": "en", "name": "tbsp" },
      { "locale": "de", "name": "EL" },
      { "locale": "nl", "name": "el" }
    ],
    "plural": [
      { "locale": "en", "name": "tbsp" },
      { "locale": "de", "name": "EL" },
      { "locale": "nl", "name": "eetlepels" }
    ],
    "alternates": [
      "tbsp",
      "tablespoon",
      "tablespoons",
      "EL",
      "el",
      "esslöffel",
      "eetlepel",
      "eetlepels"
    ]
  },
  "teaspoon": {
    "short": [
      { "locale": "en", "name": "tsp" },
      { "locale": "de", "name": "TL" },
      { "locale": "nl", "name": "tl" }
    ],
    "plural": [
      { "locale": "en", "name": "tsp" },
      { "locale": "de", "name": "TL" },
      { "locale": "nl", "name": "theelepels" }
    ],
    "alternates": [
      "tsp",
      "teaspoon",
      "teaspoons",
      "TL",
      "tl",
      "teelöffel",
      "theelepel",
      "theelepels"
    ]
  }
}
```

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Structure: English IDs with locale arrays                │
├─────────────────────────────────────────────────────────────┤
│ {                                                            │
│   "gram": {                                                  │
│     "short": [                                               │
│       { "locale": "en", "name": "g" },                       │
│       { "locale": "de", "name": "g" },                       │
│       { "locale": "nl", "name": "gr" }                       │
│     ],                                                       │
│     "plural": [                                              │
│       { "locale": "en", "name": "grams" },                   │
│       { "locale": "de", "name": "g" },                       │
│       { "locale": "nl", "name": "gram" }                     │
│     ],                                                       │
│     "alternates": ["g", "gram", "grams", "gramm", "gr"]     │
│   }                                                          │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Flatten for parse-ingredient library                     │
├─────────────────────────────────────────────────────────────┤
│ flattenForLibrary(config) => {                               │
│   "gram": {                                                  │
│     "short": "g",        // Use first locale's short        │
│     "plural": "grams",   // Use first locale's plural       │
│     "alternates": ["g", "gram", "grams", "gramm", "gr"]     │
│   }                                                          │
│ }                                                            │
│ // Library doesn't care about locales, just needs flat map  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. Parse with library                                        │
├─────────────────────────────────────────────────────────────┤
│ parseIngredient("500 gramm Mehl", {                         │
│   additionalUOMs: flattenedUnits                            │
│ })                                                           │
│                                                              │
│ => Library finds "gramm" in alternates                       │
│ => Returns: { unitOfMeasureID: "gram", quantity: 500 }       │
│ => We store: unit = "gram" (English canonical ID)            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. Display for user's locale                                │
├─────────────────────────────────────────────────────────────┤
│ From DB: { unit: "gram", quantity: 500 }                    │
│                                                              │
│ German user (locale: "de"):                                 │
│   formatUnit("gram", 500, "de", config)                     │
│   => config.gram.plural.find(p => p.locale === "de")         │
│   => { locale: "de", name: "g" }                             │
│   => Display: "500 g"                                        │
│                                                              │
│ English user (locale: "en"):                                │
│   formatUnit("gram", 500, "en", config)                     │
│   => config.gram.plural.find(p => p.locale === "en")         │
│   => { locale: "en", name: "grams" }                         │
│   => Display: "500 grams"                                    │
│                                                              │
│ Dutch user (locale: "nl"):                                  │
│   formatUnit("gram", 500, "nl", config)                     │
│   => config.gram.plural.find(p => p.locale === "nl")         │
│   => { locale: "nl", name: "gram" }                          │
│   => Display: "500 gram"                                     │
└─────────────────────────────────────────────────────────────┘
```

### Solution Components

#### 1. New Unit Definition Schema

```typescript
// Old schema
type UnitDef = {
  short: string;
  plural: string;
  alternates: string[];
};

// New schema
type LocalizedName = {
  locale: string; // Any locale string (en, de, nl, fr, es, etc.)
  name: string;
};

type UnitDef = {
  short: LocalizedName[];
  plural: LocalizedName[];
  alternates: string[];
};

type UnitsConfig = Record<string, UnitDef>; // English IDs as keys
```

#### 2. Flatten for Library

```typescript
function flattenForLibrary(config: UnitsConfig): UnitsMap {
  const flattened: UnitsMap = {};

  for (const [unitId, unitDef] of Object.entries(config)) {
    flattened[unitId] = {
      short: unitDef.short[0]?.name || unitId, // Use first locale
      plural: unitDef.plural[0]?.name || unitId, // Use first locale
      alternates: unitDef.alternates,
    };
  }

  return flattened;
}
```

#### 3. Parse with Library

```typescript
function parseIngredientWithDefaults(
  input: string | string[],
  unitsConfig: UnitsConfig
): ReturnType<typeof parseIngredient> {
  // Flatten for library
  const flatUnits = flattenForLibrary(unitsConfig);

  // Library does all the work
  const parsed = parseIngredient(input, {
    additionalUOMs: flatUnits,
  });

  // Returns unitOfMeasureID (English canonical ID)
  return parsed;
}
```

#### 4. Format for Display

**Design Decision: Always Use Short Form**

The implementation always uses the short/abbreviated form for consistent, clean display across all locales and quantities. This provides a modern recipe UI aesthetic and avoids mixing abbreviations with full words.

```typescript
function formatUnit(unitId: string, userLocale: string, config: UnitsConfig): string {
  const unitDef = config[unitId];
  if (!unitDef) return unitId; // Unknown unit, return as-is

  // Always use short form for consistent abbreviated display
  const forms = unitDef.short;

  // Find user's locale (exact match)
  const localized = forms.find((f) => f.locale === userLocale);
  if (localized) return localized.name;

  // Try base locale match (e.g., "de" for "de-formal")
  const baseLocale = userLocale.split("-")[0];
  if (baseLocale !== userLocale) {
    const baseMatch = forms.find((f) => f.locale === baseLocale);
    if (baseMatch) return baseMatch.name;
  }

  // Fallback to English
  const en = forms.find((f) => f.locale === "en");
  if (en) return en.name;

  // Last resort: first available
  return forms[0]?.name || unitId;
}
```

**Examples:**

- English: "500 g" (not "500 grams")
- German: "2 EL" (not "2 Esslöffel")
- Dutch: "100 gr" (not "100 gram")

This keeps the UI concise and modern while still being locale-appropriate.

#### 5. No Database Changes

```typescript
interface Ingredient {
  unit: string; // Stores English canonical ID from parse-ingredient
}
```

## Example Units

### Metric Units (German)

```json
{
  "gram": {
    "short": [
      { "locale": "en", "name": "g" },
      { "locale": "de", "name": "g" },
      { "locale": "nl", "name": "gr" },
      { "locale": "fr", "name": "g" }
    ],
    "plural": [
      { "locale": "en", "name": "grams" },
      { "locale": "de", "name": "g" },
      { "locale": "nl", "name": "gram" },
      { "locale": "fr", "name": "grammes" }
    ],
    "alternates": ["g", "gram", "grams", "gramm", "gr", "grammen", "grammes"]
  },
  "tablespoon": {
    "short": [
      { "locale": "en", "name": "tbsp" },
      { "locale": "de", "name": "EL" },
      { "locale": "nl", "name": "el" },
      { "locale": "fr", "name": "cs" }
    ],
    "plural": [
      { "locale": "en", "name": "tbsp" },
      { "locale": "de", "name": "EL" },
      { "locale": "nl", "name": "eetlepels" },
      { "locale": "fr", "name": "cuillères à soupe" }
    ],
    "alternates": [
      "tbsp",
      "tablespoon",
      "tablespoons",
      "EL",
      "el",
      "esslöffel",
      "eetlepel",
      "eetlepels",
      "cs",
      "cuillère à soupe"
    ]
  }
}
```

### Spoon Measurements

```json
{
  "tablespoon": {
    "short": [
      { "locale": "en", "name": "tbsp" },
      { "locale": "de", "name": "EL" },
      { "locale": "nl", "name": "el" }
    ],
    "plural": [
      { "locale": "en", "name": "tbsp" },
      { "locale": "de", "name": "EL" },
      { "locale": "nl", "name": "eetlepels" }
    ],
    "alternates": [
      "tbsp",
      "tablespoon",
      "tablespoons",
      "EL",
      "el",
      "esslöffel",
      "essl.",
      "eetlepel",
      "eetlepels"
    ]
  },
  "teaspoon": {
    "short": [
      { "locale": "en", "name": "tsp" },
      { "locale": "de", "name": "TL" },
      { "locale": "nl", "name": "tl" }
    ],
    "plural": [
      { "locale": "en", "name": "tsp" },
      { "locale": "de", "name": "TL" },
      { "locale": "nl", "name": "theelepels" }
    ],
    "alternates": [
      "tsp",
      "teaspoon",
      "teaspoons",
      "TL",
      "tl",
      "teelöffel",
      "theelepel",
      "theelepels"
    ]
  }
}
```

## Custom UOM Validation

Admins can add custom units with **any locale** they need (not limited to en/de/nl):

```typescript
const LocalizedNameSchema = z.object({
  locale: z.string().min(1), // Any locale string
  name: z.string().min(1),
});

const UnitDefSchema = z.object({
  short: z.array(LocalizedNameSchema).min(1),
  plural: z.array(LocalizedNameSchema).min(1),
  alternates: z.array(z.string()),
});

const UnitsMapSchema = z.record(z.string(), UnitDefSchema);
```

**Valid custom unit with French locale:**

```json
{
  "bunch": {
    "short": [
      { "locale": "en", "name": "bunch" },
      { "locale": "de", "name": "Bund" },
      { "locale": "fr", "name": "bouquet" }
    ],
    "plural": [
      { "locale": "en", "name": "bunches" },
      { "locale": "de", "name": "Bund" },
      { "locale": "fr", "name": "bouquets" }
    ],
    "alternates": ["bunch", "bunches", "bund", "bündel", "bouquet", "bouquets"]
  }
}
```

**Users can add any locale:**

- French: `fr`
- Spanish: `es`
- Italian: `it`
- Japanese: `ja`
- Or any custom locale code they need

**Valid custom unit:**

```json
{
  "bunch": {
    "short": [
      { "locale": "en", "name": "bunch" },
      { "locale": "de", "name": "Bund" }
    ],
    "plural": [
      { "locale": "en", "name": "bunches" },
      { "locale": "de", "name": "Bund" }
    ],
    "alternates": ["bunch", "bunches", "bund", "bündel"]
  }
}
```

## Affected Capabilities

- **ingredient-parsing** - Store canonical English IDs, format with locale arrays
- **unit-configuration** - English IDs with locale arrays for short/plural

## User-Facing Changes

**Before:** All users see "500 grams flour"

**After:**

- German: "500 g Mehl"
- English: "500 grams flour"
- Dutch: "500 gram bloem"

## Database Seeding Strategy

### Initial Deployment (v0.16.0)

**On startup, seed new units.default.json to database:**

1. **Check if units config exists in database**
2. **If NOT exists OR `isOverwritten = false`:**
   - Load new `units.default.json` (English IDs + locale arrays)
   - Save to database with `isOverwritten = false`
   - **⚠️ This OVERWRITES existing custom units on first deployment WHICH IS ACCEPTABLE**
3. **If `isOverwritten = true`:**
   - Skip seeding - user has customized their UOMs
   - Keep their custom config intact

### Admin Customization Flow

1. **Admin views UOM list** - Shows current JSON from database
2. **Admin edits JSON** - Validates against new schema
3. **Admin saves changes:**
   - Validate JSON format (English IDs + locale arrays)
   - If valid: Save to database with `isOverwritten = true`
   - If invalid: Throw validation error with specific message
4. **Future patches:**
   - If `isOverwritten = true` => Skip seeding (preserve custom config)
   - If `isOverwritten = false` => Update to new default (user hasn't customized)

### Version Detection

```typescript
// Detect if units.default.json changed between versions
const defaultUnitsHash = hashJson(defaultUnits); // SHA256 of file
const dbUnitsHash = await getConfig("units_default_hash");

if (defaultUnitsHash !== dbUnitsHash) {
  // units.default.json was updated in new patch
  const isOverwritten = await getConfig("units_is_overwritten");

  if (!isOverwritten) {
    // User hasn't customized - safe to update
    await seedDefaultUnits(defaultUnits);
    await setConfig("units_default_hash", defaultUnitsHash);
  } else {
    // User has customized - preserve their config
    console.log("Units config customized by admin - skipping update");
  }
}
```

### User Impact

**⚠️ BREAKING CHANGE - v0.16.0 Patch Notes:**

> **UOM Configuration Reset**
>
> The unit of measure system has been restructured to support multi-language display.
> **All custom UOM configurations will be reset to defaults on first startup.**
>
> If you have customized your units:
>
> 1. Export/backup your custom units before upgrading
> 2. After upgrade, re-apply customizations in the admin panel
> 3. Save changes - your config will be preserved in future updates
>
> **Why this change?**
> Units now support locale-specific display (German users see "g", English users see "grams").
> The new structure requires English canonical IDs with locale arrays.

### Migration Path

**No ingredient data migration needed:**

The current live code (main branch) already stores `unitOfMeasureID` from the parse-ingredient library directly in the database:

```typescript
// Current implementation (already live on main)
unit: ing.unitOfMeasureID; // Already storing canonical IDs
```

This means:

- **Existing data:** Already contains canonical English IDs like `"gram"`, `"tablespoon"`, etc.
- **No schema changes needed:** The `unit` column already stores the correct format
- **Only config changes:** We're just restructuring the units configuration to support locale-specific display
- **Backward compatible:** Old units will fall back to displaying the ID if not found in new config

## Success Criteria

- ✅ Parse "500 gramm Mehl" => stores `unit: "gram"` (English canonical ID)
- ✅ German user sees "500 g", English sees "500 grams", Dutch sees "500 gram"
- ✅ All alternates in one array (no locale separation needed)
- ✅ parse-ingredient library does all parsing
- ✅ No ingredient data migration needed
- ✅ Admin custom UOMs validated against new schema
- ✅ On startup: seed default units if not customized
- ✅ Admin saves: set `isOverwritten = true` to preserve customizations
- ✅ Future patches: respect `isOverwritten` flag

## Benefits of This Structure

1. **Single canonical ID** - English ID is universal ("gram", "tablespoon")
2. **All alternates together** - No need to merge, library gets all at once
3. **Clear locale mapping** - Short/plural arrays explicitly map locale to display form
4. **Backward compatible** - Old data still works (just doesn't format)
5. **Simple lookup** - `config[unitId].plural.find(p => p.locale === userLocale)`
6. **No conflicts** - Can't have duplicate IDs since keys are English

## References

- Issue: [#253](https://github.com/norish-recipes/norish/issues/253)
- parse-ingredient: [parse-ingredient v2](https://github.com/jjgonecrypto/parse-ingredient)
