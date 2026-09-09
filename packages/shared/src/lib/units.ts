/**
 * The one unit table. Reconciling a grocery's amount with a Pack Size needs
 * to know, for every unit anybody writes, its family and its size in the
 * family's base measure: grams, millilitres or pieces. Units are a closed
 * set — unlike search words, which the Search Address design refused to keep
 * a list of — so this is a fixed table in code that nobody can misconfigure,
 * seeded from the units map's fourteen locales, parse-ingredient's built-ins
 * and the words shops print on their shelves. See ADR-0029.
 *
 * This is deliberately not `normalizeUnit` in `unit-localization.ts`, which
 * reads the administrator's units map: that map is for recognising what a
 * recipe says, and a unit a household adds to it has no magnitude Norish
 * could price with. A unit this table does not know prices as one pack.
 */
import unitsMap from "@norish/config/units.default.json";

/** Mass in grams, volume in millilitres, count in pieces; a container on a grocery means packs. */
export type UnitFamily = "mass" | "volume" | "count" | "pack";

/** Every unit a Pack Size can be stated in, and a grocery amount reconciled through. */
export const UNIT_IDS = [
  "gram",
  "kilogram",
  "milligram",
  "ounce",
  "pound",
  "milliliter",
  "centiliter",
  "deciliter",
  "liter",
  "fluid_ounce",
  "teaspoon",
  "tablespoon",
  "cup",
  "piece",
  "dozen",
  "pack",
] as const;

export type UnitId = (typeof UNIT_IDS)[number];

export interface ResolvedUnit {
  id: UnitId;
  family: UnitFamily;
  /** How many of the family's base measure one of this unit is. */
  magnitude: number;
}

interface UnitEntry extends ResolvedUnit {
  /** The symbol Norish writes it with where the shop supplied no words: "g", "kg", "fl oz". */
  label: string;
  /** Spellings beyond what the units map carries: shop words, parse-ingredient's, the label itself. */
  spellings: string[];
  /** Which units-map entries spell this unit too. */
  mapIds: string[];
}

const TABLE: UnitEntry[] = [
  {
    id: "gram",
    family: "mass",
    magnitude: 1,
    label: "g",
    spellings: ["g", "gr", "gram", "grams", "gramme", "grammes", "gramm"],
    mapIds: ["gram"],
  },
  {
    id: "kilogram",
    family: "mass",
    magnitude: 1000,
    label: "kg",
    spellings: [
      "kg",
      "kgs",
      "kilo",
      "kilos",
      "kilogram",
      "kilograms",
      "kilogramme",
      "кг",
      "킬로그램",
    ],
    mapIds: [],
  },
  {
    id: "milligram",
    family: "mass",
    magnitude: 0.001,
    label: "mg",
    spellings: ["mg", "milligram", "milligrams"],
    mapIds: [],
  },
  {
    id: "ounce",
    family: "mass",
    magnitude: 28.349523,
    label: "oz",
    spellings: ["oz", "ounce", "ounces"],
    mapIds: ["ounce"],
  },
  {
    id: "pound",
    family: "mass",
    magnitude: 453.59237,
    label: "lb",
    spellings: ["lb", "lbs", "pound", "pounds"],
    mapIds: ["pound"],
  },
  {
    id: "milliliter",
    family: "volume",
    magnitude: 1,
    label: "ml",
    spellings: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
    mapIds: ["milliliter"],
  },
  {
    id: "centiliter",
    family: "volume",
    magnitude: 10,
    label: "cl",
    spellings: ["cl", "centiliter", "centiliters", "centilitre", "centilitres"],
    mapIds: ["centiliter"],
  },
  {
    id: "deciliter",
    family: "volume",
    magnitude: 100,
    label: "dl",
    spellings: ["dl", "deciliter", "deciliters", "decilitre", "decilitres"],
    mapIds: ["deciliter"],
  },
  {
    id: "liter",
    family: "volume",
    magnitude: 1000,
    label: "l",
    spellings: ["l", "ltr", "liter", "liters", "litre", "litres", "lt"],
    mapIds: ["liter"],
  },
  {
    id: "fluid_ounce",
    family: "volume",
    magnitude: 29.57353,
    label: "fl oz",
    spellings: ["fl oz", "floz", "fl. oz", "fluid ounce", "fluid ounces", "fl ounce", "fl ounces"],
    mapIds: [],
  },
  {
    id: "teaspoon",
    family: "volume",
    magnitude: 5,
    label: "tsp",
    spellings: ["tsp", "teaspoon", "teaspoons", "t"],
    mapIds: ["teaspoon", "heaping_teaspoon", "scant_teaspoon"],
  },
  {
    id: "tablespoon",
    family: "volume",
    magnitude: 15,
    label: "tbsp",
    spellings: ["tbsp", "tablespoon", "tablespoons"],
    mapIds: ["tablespoon", "heaping_tablespoon", "scant_tablespoon"],
  },
  {
    id: "cup",
    family: "volume",
    magnitude: 240,
    label: "cup",
    spellings: ["cup", "cups", "c"],
    mapIds: ["cup"],
  },
  {
    id: "piece",
    family: "count",
    magnitude: 1,
    label: "piece",
    spellings: ["st", "stuk", "stuks", "pc", "pcs", "piece", "pieces", "stk", "szt", "шт", "개"],
    mapIds: ["piece"],
  },
  {
    id: "dozen",
    family: "count",
    magnitude: 12,
    label: "dozen",
    spellings: ["dozen", "dz"],
    mapIds: ["dozen"],
  },
  {
    id: "pack",
    family: "pack",
    magnitude: 1,
    label: "pack",
    spellings: ["pack", "packs", "pak", "package", "packages", "pkg", "carton", "cartons"],
    mapIds: ["pack", "box", "bottle", "can", "jar", "bag", "tub", "bar", "roll", "pot", "pouch"],
  },
];

/** A spelling as it is looked up: lower case, no trailing dot, one space between words. */
function fold(spelling: string): string {
  return spelling.trim().toLowerCase().replace(/\.+$/, "").replace(/\s+/g, " ");
}

type MapEntry = { short: { name: string }[]; plural: { name: string }[]; alternates: string[] };

function mapSpellings(id: string): string[] {
  const entry = (unitsMap as Record<string, MapEntry>)[id];

  if (!entry) return [];

  return [
    id,
    ...entry.short.map((form) => form.name),
    ...entry.plural.map((form) => form.name),
    ...entry.alternates,
  ];
}

/**
 * Every spelling to the unit it names. Built once; the first unit to claim a
 * spelling keeps it, and the table above is ordered so the specific claim
 * comes before the loose one — "st" is a piece before anything else.
 */
const BY_SPELLING: Map<string, ResolvedUnit> = (() => {
  const map = new Map<string, ResolvedUnit>();

  for (const entry of TABLE) {
    const unit: ResolvedUnit = { id: entry.id, family: entry.family, magnitude: entry.magnitude };
    const spellings = [
      entry.id,
      entry.label,
      ...entry.spellings,
      ...entry.mapIds.flatMap(mapSpellings),
    ];

    for (const spelling of spellings) {
      const key = fold(spelling);

      if (key && !map.has(key)) map.set(key, unit);
    }
  }

  return map;
})();

const BY_ID = new Map(TABLE.map((entry) => [entry.id, entry] as const));

/** UN/CEFACT codes, and the codes retailers write in their place. */
const BY_CODE: Record<string, UnitId> = {
  GRM: "gram",
  KGM: "kilogram",
  MGM: "milligram",
  LTR: "liter",
  LT: "liter",
  MLT: "milliliter",
  CLT: "centiliter",
  DLT: "deciliter",
  ONZ: "ounce",
  LBR: "pound",
  C62: "piece",
  EA: "piece",
  H87: "piece",
};

/** The unit a word names, or null for a word that is not a unit of sale — a pinch, a slice, a bunch. */
export function resolveUnit(spelling: string | null | undefined): ResolvedUnit | null {
  if (!spelling) return null;

  return BY_SPELLING.get(fold(spelling)) ?? null;
}

/** The unit a UN/CEFACT code names, else the unit its text names, else null. */
export function resolveUnitCode(code: string | null | undefined): ResolvedUnit | null {
  if (!code) return null;
  const id = BY_CODE[code.trim().toUpperCase()];

  return id ? unitById(id) : resolveUnit(code);
}

export function unitById(id: UnitId): ResolvedUnit {
  const entry = BY_ID.get(id);

  if (!entry) throw new Error(`Unknown unit ${id}`);

  return { id: entry.id, family: entry.family, magnitude: entry.magnitude };
}

/** Norish's own symbol for a unit, for a Pack Size a shop supplied no words for. */
export function unitLabel(id: UnitId): string {
  return BY_ID.get(id)?.label ?? id;
}

/** Whether a string names one of the units a Pack Size may be stated in. */
export function isUnitId(value: string): value is UnitId {
  return BY_ID.has(value as UnitId);
}
