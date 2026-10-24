/**
 * The junk pile's seed (CONTEXT.md): generic texts that name no food in every language Norish reads,
 * put on the pile at boot, each once from the version it came in, so one a person took off stays off.
 */
import { withTransaction } from "@norish/db/drizzle";
import { addToJunkPile } from "@norish/db/repositories/ingredient-junk-pile";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { forgetSpellingRules } from "../resolver";
import { oncePerVersion } from "./catalogue-seed";

/** A text in each catalogue language Norish reads (`CATALOGUE_LANGUAGES`), one or several forms. */
type Translations = Readonly<Record<string, string | readonly string[]>>;

/**
 * What names no food, by concept, in every language Norish reads, with the version it came in.
 * Generic words only, never a recipe's own wording; a new concept takes a new, higher version.
 */
export const JUNK_SEED_CONCEPTS: Readonly<
  Record<string, { version: number; texts: Translations }>
> = {
  ingredients: {
    version: 1,
    texts: {
      en: "ingredients",
      nl: "ingrediënten",
      de: "Zutaten",
      fr: "ingrédients",
      es: "ingredientes",
      ru: "ингредиенты",
      ko: "재료",
      nb: "ingredienser",
      no: "ingredienser",
      nn: "ingrediensar",
      pl: "składniki",
      da: "ingredienser",
      it: "ingredienti",
      pt: "ingredientes",
      bg: "съставки",
      fi: "ainekset",
      uk: "інгредієнти",
    },
  },
  "to taste": {
    version: 1,
    texts: {
      en: "to taste",
      nl: "naar smaak",
      de: "nach Geschmack",
      fr: "au goût",
      es: "al gusto",
      ru: "по вкусу",
      ko: "기호에 따라",
      nb: "etter smak",
      no: "etter smak",
      nn: "etter smak",
      pl: "do smaku",
      da: "efter smag",
      it: ["q.b.", "a piacere"],
      pt: ["a gosto", "q.b."],
      bg: "на вкус",
      fi: "maun mukaan",
      uk: "за смаком",
    },
  },
  optional: {
    version: 1,
    texts: {
      en: "optional",
      nl: "optioneel",
      de: "optional",
      fr: "facultatif",
      es: "opcional",
      ru: "по желанию",
      ko: "선택",
      nb: "valgfritt",
      no: "valgfritt",
      nn: "valfritt",
      pl: "opcjonalnie",
      da: "valgfri",
      it: "facoltativo",
      pt: "opcional",
      bg: "по желание",
      fi: "valinnainen",
      uk: "за бажанням",
    },
  },
  boneless: {
    version: 1,
    texts: {
      en: "boneless",
      nl: "zonder bot",
      de: "ohne Knochen",
      fr: "désossé",
      es: "deshuesado",
      ru: "без костей",
      ko: "뼈 없는",
      nb: "benfri",
      no: "benfri",
      nn: "beinfri",
      pl: "bez kości",
      da: "uden ben",
      it: "disossato",
      pt: "desossado",
      bg: "без кости",
      fi: "luuton",
      uk: "без кісток",
    },
  },
  skinless: {
    version: 1,
    texts: {
      en: "skinless",
      nl: "zonder vel",
      de: "ohne Haut",
      fr: "sans peau",
      es: "sin piel",
      ru: "без кожи",
      ko: "껍질 없는",
      nb: "uten skinn",
      no: "uten skinn",
      nn: "utan skinn",
      pl: "bez skóry",
      da: "uden skind",
      it: "senza pelle",
      pt: "sem pele",
      bg: "без кожа",
      fi: "nahaton",
      uk: "без шкіри",
    },
  },
  // Dutch "gehakt" is minced meat, so chopped is "fijngehakt" there.
  chopped: {
    version: 1,
    texts: {
      en: "chopped",
      nl: "fijngehakt",
      de: "gehackt",
      fr: "haché",
      es: "picado",
      ru: "нарезанный",
      ko: "다진",
      nb: "hakket",
      no: "hakket",
      nn: "hakka",
      pl: "posiekany",
      da: "hakket",
      it: "tritato",
      pt: "picado",
      bg: "нарязан",
      fi: "hienonnettu",
      uk: "нарізаний",
    },
  },
  "roughly chopped": {
    version: 1,
    texts: {
      en: "roughly chopped",
      nl: "grof gehakt",
      de: "grob gehackt",
      fr: "grossièrement haché",
      es: "picado grueso",
      ru: "крупно нарезанный",
      ko: "굵게 다진",
      nb: "grovt hakket",
      no: "grovt hakket",
      nn: "grovt hakka",
      pl: "grubo posiekany",
      da: "groft hakket",
      it: "tritato grossolanamente",
      pt: "picado grosseiramente",
      bg: "едро нарязан",
      fi: "karkeasti hienonnettu",
      uk: "крупно нарізаний",
    },
  },
  melted: {
    version: 1,
    texts: {
      en: "melted",
      nl: "gesmolten",
      de: "geschmolzen",
      fr: "fondu",
      es: "derretido",
      ru: "растопленный",
      ko: "녹인",
      nb: "smeltet",
      no: "smeltet",
      nn: "smelta",
      pl: "roztopiony",
      da: "smeltet",
      it: "fuso",
      pt: "derretido",
      bg: "разтопен",
      fi: "sulatettu",
      uk: "розтоплений",
    },
  },
  overnight: {
    version: 1,
    texts: {
      en: "overnight",
      nl: "een nacht",
      de: "über Nacht",
      fr: "une nuit",
      es: "toda la noche",
      ru: "на ночь",
      ko: "하룻밤",
      nb: "over natten",
      no: "over natten",
      nn: "over natta",
      pl: "na noc",
      da: "natten over",
      it: "una notte",
      pt: "durante a noite",
      bg: "за една нощ",
      fi: "yön yli",
      uk: "на ніч",
    },
  },
  "baking dish": {
    version: 1,
    texts: {
      en: "baking dish",
      nl: "bakvorm",
      de: "Auflaufform",
      fr: "plat à gratin",
      es: "fuente para horno",
      ru: "форма для запекания",
      ko: "오븐 용기",
      nb: "ildfast form",
      no: "ildfast form",
      nn: "eldfast form",
      pl: "naczynie żaroodporne",
      da: "ovnfast fad",
      it: "pirofila",
      pt: "travessa de forno",
      bg: "тава за печене",
      fi: "uunivuoka",
      uk: "форма для запікання",
    },
  },
  "cake tin": {
    version: 1,
    texts: {
      en: "cake tin",
      nl: "cakevorm",
      de: "Kastenform",
      fr: "moule à cake",
      es: "molde para bizcocho",
      ru: "форма для кекса",
      ko: "파운드 틀",
      nb: "kakeform",
      no: "kakeform",
      nn: "kakeform",
      pl: "keksówka",
      da: "kageform",
      it: "stampo da plumcake",
      pt: "forma de bolo",
      bg: "форма за кекс",
      fi: "kakkuvuoka",
      uk: "форма для кексу",
    },
  },
  "springform pan": {
    version: 1,
    texts: {
      en: "springform pan",
      nl: "springvorm",
      de: "Springform",
      fr: "moule à charnière",
      es: "molde desmontable",
      ru: "разъёмная форма",
      ko: "분리형 케이크 틀",
      nb: "springform",
      no: "springform",
      nn: "springform",
      pl: "tortownica",
      da: "springform",
      it: "tortiera apribile",
      pt: "forma de fundo removível",
      bg: "форма с падащо дъно",
      fi: "irtopohjavuoka",
      uk: "рознімна форма",
    },
  },
  "food processor": {
    version: 1,
    texts: {
      en: "food processor",
      nl: "keukenmachine",
      de: "Küchenmaschine",
      fr: "robot culinaire",
      es: "procesador de alimentos",
      ru: "кухонный комбайн",
      ko: "푸드 프로세서",
      nb: "foodprosessor",
      no: "foodprosessor",
      nn: "foodprosessor",
      pl: "robot kuchenny",
      da: "foodprocessor",
      it: "robot da cucina",
      pt: "processador de alimentos",
      bg: "кухненски робот",
      fi: "monitoimikone",
      uk: "кухонний комбайн",
    },
  },
  "rolling pin": {
    version: 1,
    texts: {
      en: "rolling pin",
      nl: "deegroller",
      de: "Nudelholz",
      fr: "rouleau à pâtisserie",
      es: "rodillo",
      ru: "скалка",
      ko: "밀대",
      nb: "kjevle",
      no: "kjevle",
      nn: "kjevle",
      pl: "wałek do ciasta",
      da: "kagerulle",
      it: "mattarello",
      pt: "rolo da massa",
      bg: "точилка",
      fi: "kaulin",
      uk: "качалка",
    },
  },
};

/** Broken text an import can leave, the same in every language. */
const ANY_LANGUAGE = [
  { text: "null", version: 1 },
  { text: "undefined", version: 1 },
];

/** Every seed text with its version, once per fold (the first version that has it). */
export const JUNK_SEED: ReadonlyArray<{ text: string; version: number }> = [
  ...Object.values(JUNK_SEED_CONCEPTS)
    .sort((a, b) => a.version - b.version)
    .flatMap(({ version, texts }) =>
      Object.values(texts)
        .flat()
        .map((text) => ({ text, version }))
    ),
  ...ANY_LANGUAGE,
].filter(
  (entry, index, all) =>
    all.findIndex(
      (other) => ingredientAliasFold(other.text) === ingredientAliasFold(entry.text)
    ) === index
);

export const JUNK_SEED_VERSION = Math.max(...JUNK_SEED.map((entry) => entry.version));

/** Put the entries newer than the version last run on the pile; null where this version ran. */
export async function seedJunkPileOnce(
  seed: ReadonlyArray<{ text: string; version: number }> = JUNK_SEED
): Promise<{ added: number } | null> {
  const outcome = await oncePerVersion(
    "junkSeedVersion",
    Math.max(...seed.map((entry) => entry.version)),
    {
      pass: async (from) => {
        const folds = seed
          .filter((entry) => entry.version > from)
          .map((entry) => ingredientAliasFold(entry.text));

        return {
          added: await withTransaction((tx) => addToJunkPile(tx, folds, { reason: "seed" })),
        };
      },
      // The pile changes what new text names, not what any row names now.
      changed: () => false,
      done: "Junk pile seeded",
    }
  );

  if (outcome?.added) forgetSpellingRules();

  return outcome;
}
