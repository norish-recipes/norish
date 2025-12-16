import { parseIsoDuration, parseIngredientWithDefaults } from "@/lib/helpers";
import { downloadBestImageFromJsonLd } from "@/lib/downloader";
import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { getUnits } from "@/config/server-config-loader";

export async function normalizeRecipeFromJson(json: any): Promise<FullRecipeInsertDTO | null> {
  if (!json) return null;

  const units = await getUnits();

  // --- INGREDIENTS ---
  const ingSource = json.recipeIngredient ?? json.ingredients;
  const ingredients = Array.isArray(ingSource)
    ? parseIngredientWithDefaults(
      ingSource.map((v: any) => v?.toString() || "").filter(Boolean),
      units
    )
    : typeof ingSource === "string"
      ? parseIngredientWithDefaults(ingSource.toString(), units)
      : [];

  const systemUsed = inferSystemUsedFromParsed(ingredients);

  // --- STEPS ---
  const rawSteps: string[] = [];
  const collectSteps = (node: any) => {
    if (!node) return;

    if (typeof node === "string") {
      const s = node.trim();

      if (s) rawSteps.push(s);

      return;
    }

    if (Array.isArray(node)) {
      node.forEach(collectSteps);

      return;
    }

    if (typeof node === "object") {
      const obj: any = node;
      const type = String(obj["@type"] ?? obj.type ?? "").toLowerCase();
      const item = obj.item && typeof obj.item === "object" ? obj.item : undefined;
      const text =
        typeof obj.text === "string"
          ? obj.text
          : item && typeof item.text === "string"
            ? item.text
            : undefined;
      const name =
        typeof obj.name === "string"
          ? obj.name
          : item && typeof item.name === "string"
            ? item.name
            : undefined;
      const chosen = (text || name || "").toString().trim();

      if (chosen) {
        if (
          type.includes("howtostep") ||
          type.includes("howtodirection") ||
          type.includes("listitem") ||
          (!obj.itemListElement && !obj.item)
        ) {
          rawSteps.push(chosen);
        }
      }

      if (obj.itemListElement) collectSteps(obj.itemListElement);
      if (obj.item) collectSteps(obj.item);
    }
  };

  collectSteps(json?.recipeInstructions);

  // --- Deduplicate + preserve order ---
  const seenSteps = new Set<string>();
  const steps = rawSteps
    .filter((s) => {
      const k = s?.trim();

      if (!k) return false;

      const key = k.toLowerCase();

      if (seenSteps.has(key)) return false;

      seenSteps.add(key);

      return true;
    })
    .map((t, i) => ({
      step: t,
      systemUsed,
      order: i + 1,
    }));

  const images = json.image;

  // Parse servings from recipeYield
  let servings: number | undefined = undefined;

  if (json.recipeYield) {
    if (typeof json.recipeYield === "number") {
      servings = json.recipeYield;
    } else if (typeof json.recipeYield === "string") {
      const match = json.recipeYield.match(/\d+/);

      if (match) {
        servings = parseInt(match[0], 10);
      }
    }
  }

  const coreMaybe: Partial<FullRecipeInsertDTO> = {
    name: json.name ?? json.headline,
    image: await downloadBestImageFromJsonLd(images),
    url: "",
    description: typeof json.description === "string" ? json.description : undefined,
    servings,
    steps,
    systemUsed,
    prepMinutes: json.prepTime ? parseIsoDuration(json.prepTime) : undefined,
    cookMinutes: json.cookTime ? parseIsoDuration(json.cookTime) : undefined,
    totalMinutes: json.totalTime ? parseIsoDuration(json.totalTime) : undefined,
  };

  // --- FINAL STRUCTURE ---
  return {
    name: (coreMaybe.name as string) || "Untitled recipe",
    description: coreMaybe.description,
    url: coreMaybe.url,
    image: coreMaybe.image,
    servings: coreMaybe.servings as any,
    prepMinutes: coreMaybe.prepMinutes as any,
    cookMinutes: coreMaybe.cookMinutes as any,
    totalMinutes: coreMaybe.totalMinutes as any,
    systemUsed,
    steps: Array.isArray(coreMaybe.steps) ? (coreMaybe.steps as any) : steps,
    recipeIngredients: ingredients.map((ing, i) => ({
      ingredientId: null,
      ingredientName: ing.description,
      amount: ing.quantity != null ? ing.quantity : null,
      unit: ing.unitOfMeasureID,
      systemUsed,
      order: i,
    })),
    tags: Array.isArray(json.keywords)
      ? json.keywords.map((k: string) => ({ name: k.toLowerCase() }))
      : [],
  };
}
