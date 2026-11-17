// What the flows ask of the throwaway server over the control port: clean slate, a recipe, a count.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

// The recipe form's own line parser, through the web workspace's tsx.
const fromWeb = createRequire(path.join(import.meta.dirname, "../../web/package.json"));

(await import(fromWeb.resolve("tsx/esm/api"))).register();
const { addDays, dateKey, parseIngredientWithDefaults } =
  await import("@norish/shared/lib/helpers");

export const PAGE_NAME = "Maestro Lemon Cake";

// A recipe page on loopback for the import flows: schema.org JSON-LD, no bot check, no AI.
function recipePage() {
  const recipe = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: PAGE_NAME,
    recipeYield: "4",
    recipeIngredient: ["200 g flour", "3 eggs", "1 lemon"],
    recipeInstructions: [{ "@type": "HowToStep", text: "Mix everything and bake for 40 minutes." }],
  };

  return `<!doctype html><html><head><title>${PAGE_NAME}</title><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body><h1>${PAGE_NAME}</h1></body></html>`;
}

// The flows' foods in the Open Food Facts taxonomy format; their built-in icons are keyed by these ids.
const CATALOGUE = [
  "egg, eggs",
  "flour",
  "butter",
  "milk",
  "onion, onions",
  "lemon, lemons",
  "beef",
  "salt",
  "sugar",
]
  .map((names) => `en: ${names}\n`)
  .join("\n");

// A page that is not a recipe, for the failed import's toast.
function notesPage() {
  return "<!doctype html><html><head><title>Weekend notes</title></head><body><h1>Weekend notes</h1><p>Buy milk. Call the plumber.</p></body></html>";
}

export function serveRecipePage(host) {
  const page = createServer((request, response) => {
    const body = { "/recipe": recipePage(), "/notes": notesPage(), "/catalogue": CATALOGUE }[
      request.url
    ];

    response.writeHead(body === undefined ? 404 : 200, {
      "content-type": "text/html; charset=utf-8",
    });
    response.end(body ?? "");
  });

  return new Promise((resolve) => page.listen(0, host, () => resolve(page)));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What `read` answers once it holds at least `min` names, for a write still on its way.
async function namesOnceThere(read, min) {
  const deadline = Date.now() + 15_000;
  let found = await read();

  while (found.length < min && Date.now() < deadline) {
    await sleep(250);
    found = await read();
  }

  return found;
}

// `trpc` posts a mutation, `query` reads one; both throw on a failed call.
export function seeder({ trpc, query }) {
  const recipes = async (search) => {
    const { recipes } = await query("recipes.list", { limit: 200, ...(search && { search }) });

    return recipes;
  };

  return {
    // Every recipe, cookbook, grocery and pantry food the account has, so a flow starts from nothing.
    async reset() {
      const stale = (await recipes()).map(({ id, version }) => ({ id, version }));

      if (stale.length > 0) await trpc("recipes.delete", { recipes: stale });

      const { cookbooks } = await query("cookbooks.list", { limit: 200, cursor: 0 });

      for (const { id, version } of cookbooks) await trpc("cookbooks.remove", { id, version });

      const { groceries } = await query("groceries.list");

      if (groceries.length > 0) {
        await trpc("groceries.delete", {
          groceries: groceries.map(({ id, version }) => ({ id, version })),
        });
      }

      for (const { id } of await query("pantry.list")) await trpc("pantry.remove", { id });
    },
    // A recipe as the recipe form saves one; answers its id.
    createRecipe({ name, ingredients = [], steps = [], tags = [], minutes }) {
      return trpc("recipes.create", {
        name,
        systemUsed: "metric",
        servings: 2,
        ...(minutes && { totalMinutes: minutes }),
        recipeIngredients: ingredients.map((text, order) => {
          const [parsed] = parseIngredientWithDefaults(text);

          return {
            ingredientName: parsed?.description || text,
            ingredientId: null,
            amount: parsed?.quantity ? Number(parsed.quantity) : null,
            unit: parsed?.unitOfMeasure || null,
            order,
          };
        }),
        steps: steps.map((step, order) => ({ step, order, systemUsed: "metric" })),
        tags: tags.map((tag) => ({ name: tag })),
        cuisines: [],
        categories: [],
        images: [],
        videos: [],
      });
    },
    async countRecipes(name) {
      return (await recipes(name)).filter((recipe) => recipe.name === name).length;
    },
    // The grocery names once there are at least `min` of them, for a write still on its way.
    groceryNames: (min = 0) =>
      namesOnceThere(
        async () => (await query("groceries.list")).groceries.map((grocery) => grocery.name),
        min
      ),
    // The local day `offset` days from today, as the app keys it.
    dayKey: (offset) => dateKey(addDays(new Date(), offset)),
    // Where the first plan of recipe `name` stands: now without a `date`, else once it is on `date` in `slot` or after 15 s.
    async plannedWhere(name, date, slot) {
      const range = {
        startISO: dateKey(addDays(new Date(), -7)),
        endISO: dateKey(addDays(new Date(), 60)),
      };
      const deadline = Date.now() + 15_000;

      for (;;) {
        const items = await query("calendar.listItems", range);
        const found = items.find((item) => item.recipeName === name);

        if (!date || (found?.date === date && found.slot === slot) || Date.now() > deadline) {
          return { date: found?.date ?? null, slot: found?.slot ?? null };
        }
        await sleep(250);
      }
    },
    // The same for the Pantry's foods.
    pantryNames: (min = 0) =>
      namesOnceThere(async () => (await query("pantry.list")).map((item) => item.name), min),
    // How the Pantry holds a food kept from the catalogue (the one `search` names exactly) and one kept as typed.
    async pantryKept(search, custom, min) {
      const entries = [];

      await namesOnceThere(async () => {
        entries.splice(0, entries.length, ...(await query("pantry.list")));

        return entries;
      }, min);

      const { items } = await query("ingredients.list", {
        search,
        locale: "en",
        listedOnly: false,
      });
      const found = items.filter((food) => food.name.toLowerCase() === search.toLowerCase());
      const ids = new Set(found.map((food) => food.id));

      return {
        count: entries.length,
        catalogue: entries.some((entry) => ids.has(entry.ingredientId)),
        custom: entries.some(
          (entry) =>
            entry.name.toLowerCase() === custom.toLowerCase() && !ids.has(entry.ingredientId)
        ),
      };
    },
  };
}
