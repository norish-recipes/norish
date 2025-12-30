import JSZip from "jszip";

import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { saveImageBytes } from "@/server/downloader";
import { getUnits } from "@/config/server-config-loader";
import { FullRecipeInsertDTO } from "@/types";
import { FullRecipeInsertSchema } from "@/server/db";

export type MelaRecipe = {
  categories?: string[];
  cookTime?: string;
  date?: number;
  favorite?: boolean;
  id?: string;
  images?: string[];
  ingredients?: string;
  instructions?: string;
  link?: string;
  notes?: string;
  nutrition?: string;
  prepTime?: string;
  text?: string;
  title?: string;
  totalTime?: string;
  wantToCook?: boolean;
  yield?: string | number;
};

function parseHumanDurationToMinutes(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.toLowerCase().match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?/i);

  if (!m) return undefined;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = m[2] ? parseInt(m[2], 10) : 0;

  const total = h * 60 + min;

  return Number.isFinite(total) && total > 0 ? total : undefined;
}

function splitNonEmptyLines(s?: string): string[] {
  if (!s) return [];

  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function normalizeServings(inp: string | number | undefined): number | undefined {
  if (inp == null) return undefined;
  if (typeof inp === "number") return Math.max(1, Math.round(inp));

  const m = String(inp).match(/\d+/);

  return m ? parseInt(m[0], 10) : undefined;
}

function base64ToBuffer(b64: string): Buffer {
  // Remove surrounding quotes and whitespace
  let s = b64
    .trim()
    .replace(/^\"|\"$/g, "")
    .replace(/\s+/g, "");

  // If there's a data URI prefix, drop it
  const comma = s.indexOf(",");

  if (/^data:\w+\/[\w+.-]+;base64,/i.test(s) && comma !== -1) s = s.slice(comma + 1);

  // If there's any explanatory prefix like 'image bytes such as: "..."', try to locate the last quote
  const firstSlash9j = s.indexOf("/9j/"); // common JPEG base64 start
  const firstPng = s.indexOf("iVBOR"); // common PNG base64 start
  const candidates = [firstSlash9j, firstPng].filter((x) => x >= 0);

  if (candidates.length) {
    const start = Math.min(...candidates);

    if (start > 0) s = s.slice(start);
  }

  return Buffer.from(s, "base64");
}

/**
 * Parse a single .melarecipe JSON payload and map to our Recipe shape.
 * Image bytes are reconstructed from the first images[] entry if present.
 */
export async function parseMelaRecipeToDTO(json: MelaRecipe): Promise<FullRecipeInsertDTO> {
  const title = (json.title || "").trim();

  if (!title) throw new Error("Missing title");

  // Save first image if present
  let image: string | undefined = undefined;

  if (json.images && json.images.length) {
    try {
      const buf = base64ToBuffer(json.images[0]);

      image = await saveImageBytes(buf, title);
    } catch {
      // ignore image failure, proceed without image
    }
  }

  const units = await getUnits();
  const ingredientArray = parseIngredientWithDefaults(json.ingredients || "", units);
  const systemUsed = inferSystemUsedFromParsed(ingredientArray);

  const stepLines = splitNonEmptyLines(json.instructions);
  const tagNames = Array.isArray(json.categories) ? json.categories.filter(Boolean) : [];
  const dto: FullRecipeInsertDTO = {
    name: title,
    url: json.link || undefined,
    image: image || undefined,
    description: json.text || undefined,
    servings: normalizeServings(json.yield),
    prepMinutes: parseHumanDurationToMinutes(json.prepTime),
    cookMinutes: parseHumanDurationToMinutes(json.cookTime),
    totalMinutes: parseHumanDurationToMinutes(json.totalTime),
    recipeIngredients: ingredientArray.map((line, i) => ({
      ingredientId: null,
      ingredientName: line.description,
      amount: line.quantity != null ? line.quantity : null,
      unit: line.unitOfMeasureID,
      systemUsed: systemUsed,
      order: i,
    })),
    steps: stepLines.map((s, i) => ({ step: s, order: i, systemUsed: systemUsed })),
    tags: tagNames.map((name) => ({ name })),
    systemUsed,
  } as FullRecipeInsertDTO;

  const parsed = FullRecipeInsertSchema.safeParse(dto);

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  return parsed.data;
}

export async function parseMelaArchive(zip: JSZip): Promise<MelaRecipe[]> {
  const entries = zip.file(/\.melarecipe$/i);
  const recipes: MelaRecipe[] = [];

  for (const entry of entries) {
    try {
      const text = await entry.async("string");
      const json = JSON.parse(text) as MelaRecipe;

      recipes.push(json);
    } catch (e: any) {
      throw new Error(`Failed to parse ${entry.name}: ${e?.message || e}`);
    }
  }

  return recipes;
}
