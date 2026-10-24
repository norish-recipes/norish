import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node

const mockFindExistingRecipe = vi.fn();
const mockCreateResolvedRecipe = vi.fn();
const mockDashboardRecipe = vi.fn();
const mockRateRecipe = vi.fn();
const mockAddFavorite = vi.fn();
const mockCreateCookbook = vi.fn();
const mockAddRecipeToCookbook = vi.fn();
const mockSaveImageBytes = vi.fn();

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { UPLOADS_DIR: "/tmp/uploads" },
}));
vi.mock("@norish/db", async () => ({
  // The real insert schema validates what the parser builds.
  FullRecipeInsertSchema: (await import("@norish/shared/contracts/zod")).FullRecipeInsertSchema,
  findExistingRecipe: mockFindExistingRecipe,
  dashboardRecipe: mockDashboardRecipe,
}));
vi.mock("@norish/shared-server/ingredients/recipe-lines", () => ({
  createResolvedRecipe: mockCreateResolvedRecipe,
  updateResolvedRecipe: vi.fn(),
}));
vi.mock("@norish/shared-server/media/dish-color", () => ({
  withDishColor: async (dto: unknown) => dto,
  withDishColorForUpdate: async (dto: unknown) => dto,
}));
vi.mock("@norish/db/repositories/ratings", () => ({ rateRecipe: mockRateRecipe }));
vi.mock("@norish/db/repositories/favorites", () => ({ addFavorite: mockAddFavorite }));
vi.mock("@norish/db/repositories/cuisines", () => ({
  listCuisines: vi.fn().mockResolvedValue([]),
}));
vi.mock("@norish/db/repositories/cookbooks", () => ({
  findOwnCookbookIdByTitle: vi.fn().mockResolvedValue(null),
  createCookbook: mockCreateCookbook,
  addRecipeToCookbook: mockAddRecipeToCookbook,
}));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));
vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: mockSaveImageBytes,
  saveStepImageBytes: vi.fn(),
  saveVideoBytes: vi.fn(),
}));

const { ArchiveFormat, getArchiveInfo, importArchive } =
  await import("@norish/shared-server/archive/parser");

type Block = {
  id?: string;
  name?: string;
  favourite?: string;
  rating?: string;
  extra?: string;
  source?: string;
  yield?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients?: string[];
  directions?: string[];
  notes?: string[];
  nutrition?: string;
  photos?: number;
};

/** A recipe block shaped like a real Italian Recipe Keeper export. */
function recipeBlock(block: Block = {}): string {
  const id = block.id ?? "07dce4e0-6065-4737-9822-5183db1c447f";
  const paragraphs = (lines: string[] = []) => lines.map((line) => `<p>${line}</p>`).join("\n");
  const photos = Array.from(
    { length: block.photos ?? 1 },
    (_, n) =>
      `<div class="recipe-photos-div"><img src="images/${id}_${n}.jpg" class="recipe-photos" itemprop=photo${n} /></div>`
  ).join("\n");

  return `
    <div class="recipe-details">
        <meta content="${id}" itemprop="recipeId">
        <meta content="" itemprop="recipeShareId">
        <meta content="${block.favourite ?? "False"}" itemprop="recipeIsFavourite">
        <meta content="${block.rating ?? "0"}" itemprop="recipeRating">
        <table><tr><td>
          <img src="images/${id}_0.jpg" class="recipe-photo"/>
        </td><td style="vertical-align:top">
          <h2 itemprop="name">${block.name ?? "Alici gratinate"}</h2>
          ${block.extra ?? `<div>Portate: <span itemprop="recipeCourse">Antipasti da provare</span></div>`}
          <div>Origine: <span itemprop="recipeSource">${block.source ?? ""}</span></div>
          <div>Porzioni: <span itemprop="recipeYield">${block.yield ?? "4 persone"}</span></div>
          <div>Tempo di preparazione: <span>15 min</span>
            <meta content="${block.prepTime ?? "PT15M"}" itemprop="prepTime"></div>
          <div>Tempo di cottura: <span></span>
            <meta content="${block.cookTime ?? "PT0S"}" itemprop="cookTime"></div>
        </td></tr><tr><td>
          <h3>Ingredienti</h3>
          <div class="recipe-ingredients" itemprop="recipeIngredients">
            ${paragraphs(block.ingredients ?? ["350 g di alici"])}
          </div>
        </td><td>
          <h3>Preparazione</h3>
          <div itemprop="recipeDirections">
            ${paragraphs(block.directions ?? ["Pulite le alici."])}
          </div>
        </td></tr></table>
        <div class="recipe-notes" itemprop="recipeNotes">
          ${paragraphs(block.notes)}
        </div>
        ${block.nutrition ?? ""}
        <h3>Foto</h3>
        ${photos}
        <hr />
    </div>`;
}

async function exportZip(blocks: string[], { wrapper = "" } = {}) {
  const zip = new JSZip();

  zip.file(
    `${wrapper}recipes.html`,
    `<!DOCTYPE html><html><head></head><body>${blocks.join("\n")}</body></html>`
  );

  for (const match of blocks.join("\n").matchAll(/itemprop=photo\d+[^>]*|src="(images\/[^"]+)"/g)) {
    if (match[1]) zip.file(`${wrapper}${match[1]}`, `bytes of ${match[1]}`);
  }

  return zip;
}

async function importBlocks(blocks: string[]) {
  const bytes = Buffer.from(await (await exportZip(blocks)).generateAsync({ type: "uint8array" }));
  const result = await importArchive("user-1", ["user-1"], bytes);

  return { result, dtos: mockCreateResolvedRecipe.mock.calls.map((call) => call[2]) };
}

describe("Recipe Keeper import", () => {
  beforeEach(() => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateResolvedRecipe.mockImplementation(async (recipeId: string) => ({
      status: "inserted",
      recipeId,
    }));
    mockDashboardRecipe.mockImplementation(async (recipeId: string) => ({ id: recipeId }));
    mockCreateCookbook.mockImplementation(async ({ title }: { title: string }) => ({
      id: `cookbook-${title}`,
    }));
    mockSaveImageBytes.mockImplementation(
      async (bytes: Buffer, recipeId: string) =>
        `/recipes/${recipeId}/${bytes.toString().split("_").pop()}`
    );
  });

  describe("detection", () => {
    it("recognises the export and counts its recipe blocks", async () => {
      const zip = await exportZip([recipeBlock(), recipeBlock({ id: "other-id" })]);

      expect(await getArchiveInfo(zip)).toEqual({
        format: ArchiveFormat.RECIPE_KEEPER,
        count: 2,
      });
    });

    it("recognises it inside a single wrapper folder", async () => {
      const zip = await exportZip([recipeBlock()], { wrapper: "RecipeKeeper_20260322_174041/" });

      expect((await getArchiveInfo(zip)).format).toBe(ArchiveFormat.RECIPE_KEEPER);
    });

    it("counts a block whose recipeId itemprop is unquoted, as a browser reads it", async () => {
      const zip = await exportZip([
        recipeBlock().replace('itemprop="recipeId"', "itemprop=recipeId"),
        // A details block carrying no recipe id is not a recipe.
        `<div class="recipe-details"><h2 itemprop="name">Not a recipe</h2></div>`,
      ]);

      expect(await getArchiveInfo(zip)).toEqual({
        format: ArchiveFormat.RECIPE_KEEPER,
        count: 1,
      });
    });

    it("does not claim a recipes.html that is not Recipe Keeper's", async () => {
      const zip = new JSZip();

      zip.file("recipes.html", "<html><body><h1>My recipes</h1></body></html>");

      expect((await getArchiveInfo(zip)).format).toBe(ArchiveFormat.UNKNOWN);
    });
  });

  it("reads every field by itemprop, whatever language its labels are in", async () => {
    const { dtos } = await importBlocks([
      recipeBlock({
        name: "Tiramisù",
        extra: `
          <div>Portate: <span itemprop="recipeCourse">Antipasti da provare</span><span>, Cena</span>
            <meta content="Cena" itemprop="recipeCourse"></div>
          <div>Categorie: <span>Pranzo, Senza cottura</span>
            <meta content="Pranzo" itemprop="recipeCategory">
            <meta content="Senza cottura" itemprop="recipeCategory"></div>
          <div>Collezioni: <span>Natale</span>
            <meta content="Natale" itemprop="recipeCollection"></div>`,
        source: `<a href="https://www.example.it/tiramisu">https://www.example.it/tiramisu</a>`,
        yield: "2-4 persone",
        prepTime: "PT1H25M",
        cookTime: "PT10M",
        notes: ["Conservazione:", "Due giorni in frigorifero."],
      }),
    ]);

    expect(dtos[0]).toMatchObject({
      name: "Tiramisù",
      url: "https://www.example.it/tiramisu",
      servings: 2,
      prepMinutes: 85,
      cookMinutes: 10,
      totalMinutes: 95,
      notes: "Conservazione:\nDue giorni in frigorifero.",
      tags: [
        { name: "Antipasti da provare" },
        { name: "Cena" },
        { name: "Pranzo" },
        { name: "Senza cottura" },
      ],
      // Only a course names a meal, and only one the matcher recognises:
      // "Pranzo" would be Lunch, but it is a category.
      categories: ["Dinner"],
    });
  });

  it("files a recipe into its collections as the importer's cookbooks", async () => {
    const { dtos } = await importBlocks([
      recipeBlock({
        extra: `<div>Collezioni: <span>Natale</span>
          <meta content="Natale" itemprop="recipeCollection"></div>`,
      }),
    ]);

    expect(mockAddRecipeToCookbook).toHaveBeenCalledWith("cookbook-Natale", dtos[0].id);
  });

  it("keeps bold and colon Headings, and numbered steps without their numbers", async () => {
    const { dtos } = await importBlocks([
      recipeBlock({
        ingredients: [
          "<b>Per il guscio</b>",
          "200 g di farina",
          "",
          "Per la crema:",
          "<b><i>Per servire</i></b>",
          "SAVOIARDI",
        ],
        directions: ["1. Impastate la farina.", "", "2. Procedimento:", "", "3. Servite."],
      }),
    ]);

    expect(
      dtos[0].recipeIngredients.map((line: { ingredientName: string }) => line.ingredientName)
    ).toEqual(["# Per il guscio", "di farina", "# Per la crema", "# Per servire", "SAVOIARDI"]);
    expect(dtos[0].steps.map((step: { step: string }) => step.step)).toEqual([
      "Impastate la farina.",
      "# Procedimento",
      "Servite.",
    ]);
  });

  it("keeps every word of a pasted list, and no separator as a step (#635)", async () => {
    const { dtos } = await importBlocks([
      recipeBlock({
        ingredients: ["• 2 uova", "•", "Burro 20 g", "Scorsa di 1 limone", ".80 g di Pecorino"],
        directions: ["-", "Montate le uova.", "-"],
      }),
    ]);

    expect(
      dtos[0].recipeIngredients.map(
        (line: { amount: number | null; ingredientName: string }) =>
          `${line.amount ?? ""} ${line.ingredientName}`
      )
    ).toEqual(["2 uova", "20 Burro", "1 Scorsa di limone", "80 di Pecorino"]);
    expect(dtos[0].steps.map((step: { step: string }) => step.step)).toEqual(["Montate le uova."]);
  });

  it("keeps calories alone when they are the only nutrition supplied", async () => {
    const { dtos } = await importBlocks([
      recipeBlock({
        nutrition: `<h3>Nutrizione</h3>
          <div>Porzioni: 30 <meta content="30" itemprop="recipeNutServingSize"></div>
          <div>Calorie: 224 <meta content="224" itemprop="recipeNutCalories"></div>
          <div>Zuccheri: 1.2 <meta content="1.2" itemprop="recipeNutSugars"></div>`,
      }),
    ]);

    expect(dtos[0]).toMatchObject({ calories: 224, fat: null, carbs: null, protein: null });
  });

  it("reads all four nutrition values", async () => {
    const { dtos } = await importBlocks([
      recipeBlock({
        nutrition: `
          <meta content="467" itemprop="recipeNutCalories">
          <meta content="12.5" itemprop="recipeNutTotalFat">
          <meta content="40" itemprop="recipeNutTotalCarbohydrate">
          <meta content="10.1" itemprop="recipeNutProtein">`,
      }),
    ]);

    expect(dtos[0]).toMatchObject({ calories: 467, fat: "12.5", carbs: "40", protein: "10.1" });
  });

  it("makes the first photo the main image and puts the rest in the gallery", async () => {
    const { dtos } = await importBlocks([recipeBlock({ photos: 2 })]);
    const id = dtos[0].id;

    expect(dtos[0].images).toEqual([
      { image: `/recipes/${id}/0.jpg`, order: 0 },
      { image: `/recipes/${id}/1.jpg`, order: 1 },
    ]);
  });

  it("says so when a recipe has more photos than the gallery holds", async () => {
    const { result, dtos } = await importBlocks([recipeBlock({ photos: 12 })]);

    expect(dtos[0].images).toHaveLength(10);
    expect(result.notes).toEqual([
      { file: "recipe_Alici gratinate", note: "Photos beyond the first 10 dropped: 2" },
    ]);
  });

  it("drops a plain-text source rather than keep it as a link", async () => {
    const { dtos } = await importBlocks([recipeBlock({ source: "Recipe Keeper" })]);

    expect(dtos[0].url).toBeUndefined();
  });

  it("imports a recipe without ingredients", async () => {
    const { result, dtos } = await importBlocks([recipeBlock({ ingredients: [] })]);

    expect(result.errors).toEqual([]);
    expect(dtos[0].recipeIngredients).toEqual([]);
  });

  it("brings the rating and favourite along, and leaves an unrated recipe unrated", async () => {
    const { dtos } = await importBlocks([
      recipeBlock({ id: "rated", name: "Rated", rating: "4", favourite: "True" }),
      recipeBlock({ id: "unrated", name: "Unrated" }),
    ]);

    expect(mockRateRecipe).toHaveBeenCalledTimes(1);
    expect(mockRateRecipe).toHaveBeenCalledWith("user-1", dtos[0].id, 4);
    expect(mockAddFavorite).toHaveBeenCalledTimes(1);
    expect(mockAddFavorite).toHaveBeenCalledWith("user-1", dtos[0].id);
  });

  it("reports a recipe without a name and imports the rest", async () => {
    const { result } = await importBlocks([
      recipeBlock({ id: "nameless", name: "" }),
      recipeBlock({ id: "named" }),
    ]);

    expect(result.imported).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});
