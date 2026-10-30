/** What the language model answers when the AI pass reads a name, as `generateStructured` returns it. */
interface ReadFood {
  written?: string;
  englishName: string;
  parents?: string[];
  nativeParents?: string[];
  category?: string | null;
  otherNames?: string[];
}

function food({
  written,
  englishName,
  parents,
  nativeParents,
  category = null,
  otherNames,
}: ReadFood) {
  return {
    written: written ?? englishName,
    englishName,
    parents: parents ?? null,
    nativeParents: nativeParents ?? null,
    category,
    otherNames: otherNames ?? null,
  };
}

/** A name read as one food. */
export function foodReading(reading: ReadFood & { sure: boolean }) {
  return {
    sure: reading.sure,
    action: { kind: "food", joined: null, reason: null },
    foods: [food(reading)],
  };
}

/** A name read as several foods: a part given as a string is its own English name. */
export function severalReading(
  parts: Array<string | ReadFood>,
  joined: "together" | "alternatives",
  sure: boolean
) {
  return {
    sure,
    action: { kind: "several", joined, reason: null },
    foods: parts.map((part) => food(typeof part === "string" ? { englishName: part } : part)),
  };
}

/** A name read as no food, by default a tool. */
export function noFoodReading(
  sure: boolean,
  reason: "equipment" | "preparation" | "note" | "gibberish" = "equipment"
) {
  return { sure, action: { kind: "not-a-food", joined: null, reason }, foods: [] };
}
