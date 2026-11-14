// What the flows ask of the throwaway server over the control port: clean slate, a recipe, a count.
import { createServer } from "node:http";

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

// A page that is not a recipe, for the failed import's toast.
function notesPage() {
  return "<!doctype html><html><head><title>Weekend notes</title></head><body><h1>Weekend notes</h1><p>Buy milk. Call the plumber.</p></body></html>";
}

export function serveRecipePage(host) {
  const page = createServer((request, response) => {
    const body = { "/recipe": recipePage(), "/notes": notesPage() }[request.url];

    response.writeHead(body === undefined ? 404 : 200, {
      "content-type": "text/html; charset=utf-8",
    });
    response.end(body ?? "");
  });

  return new Promise((resolve) => page.listen(0, host, () => resolve(page)));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `trpc` posts a mutation, `query` reads one; both throw on a failed call.
export function seeder({ trpc, query }) {
  const recipes = async (search) => {
    const { recipes } = await query("recipes.list", { limit: 200, ...(search && { search }) });

    return recipes;
  };

  return {
    // Every recipe, cookbook and grocery the account has, so a flow starts from nothing.
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
    },
    // A recipe as the recipe form saves one; answers its id.
    createRecipe({ name, ingredients = [], tags = [], minutes }) {
      return trpc("recipes.create", {
        name,
        systemUsed: "metric",
        servings: 2,
        ...(minutes && { totalMinutes: minutes }),
        recipeIngredients: ingredients.map((ingredientName, order) => ({
          ingredientName,
          ingredientId: null,
          amount: null,
          unit: null,
          order,
        })),
        steps: [],
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
    async groceryNames(min = 0) {
      const deadline = Date.now() + 15_000;
      const names = async () =>
        (await query("groceries.list")).groceries.map((grocery) => grocery.name);
      let found = await names();

      while (found.length < min && Date.now() < deadline) {
        await sleep(250);
        found = await names();
      }

      return found;
    },
  };
}
