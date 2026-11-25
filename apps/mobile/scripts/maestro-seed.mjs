// What the flows ask of the throwaway server over the control port: clean slate, a recipe, a count.
import { randomUUID } from "node:crypto";
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

// The flows' foods in the Open Food Facts taxonomy format; their built-in icons are keyed by these
// ids. Chicken thighs are a kind of chicken, which is a kind of poultry: Search's Narrow to.
const CATALOGUE = [
  "poultry",
  "< en:poultry\nen: chicken",
  "< en:chicken\nen: chicken thighs",
  "basil",
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
  .map((entry) => (entry.startsWith("<") ? `${entry}\n` : `en: ${entry}\n`))
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

// What `read` answers once it holds between `min` and `max` names, for a write still on its way;
// after 15 s it throws with what it holds instead.
async function namesOnceThere(read, { min = 0, max = Infinity } = {}) {
  const deadline = Date.now() + 15_000;
  let found = await read();

  while (found.length < min || found.length > max) {
    if (Date.now() > deadline) {
      throw new Error(`waited 15 s for ${min}..${max} names; it holds ${JSON.stringify(found)}`);
    }
    await sleep(250);
    found = await read();
  }

  return found;
}

// The planned items' window, through the date helpers.
const plannedRange = () => ({
  startISO: dateKey(addDays(new Date(), -7)),
  endISO: dateKey(addDays(new Date(), 60)),
});

// What `read` answers once it equals `is`, for a write still on its way; any answer without `is`.
async function onceItIs(read, is, what) {
  const deadline = Date.now() + 15_000;

  for (;;) {
    const found = await read();

    if (is === undefined || JSON.stringify(found) === JSON.stringify(is)) return found;
    if (Date.now() > deadline) {
      throw new Error(
        `waited 15 s for ${what} ${JSON.stringify(is)}; it is ${JSON.stringify(found)}`
      );
    }
    await sleep(250);
  }
}

// `trpc` posts a mutation, `query` reads one; both throw on a failed call.
export function seeder({ trpc, query }) {
  const recipes = async (search) => {
    const { recipes } = await query("recipes.list", { limit: 200, ...(search && { search }) });

    return recipes;
  };

  const storeIdOf = async (name) => {
    const store = (await query("stores.list")).find((candidate) => candidate.name === name);

    if (!store) throw new Error(`no Store named "${name}"`);

    return store.id;
  };

  return {
    // Every recipe, cookbook, grocery, pantry food, site token and API key the account has, and its
    // first name back, so a flow starts from nothing.
    async reset() {
      const { user, apiKeys } = await query("user.get");

      if (user.name !== "Maestro") {
        await trpc("user.updateName", { name: "Maestro", version: user.version });
      }
      for (const { id } of apiKeys) await trpc("user.apiKeys.delete", { keyId: id });
      for (const { id, version } of await query("siteAuthTokens.list")) {
        await trpc("siteAuthTokens.remove", { id, version });
      }

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

      for (const { id, version } of await query("calendar.listItems", plannedRange())) {
        await trpc("calendar.deleteItem", { itemId: id, version });
      }

      for (const { id, version } of await query("stores.list")) {
        await trpc("stores.delete", {
          storeId: id,
          version,
          deleteGroceries: false,
          grocerySnapshot: [],
        });
      }
    },
    // A header token for `domain`; answers its id.
    async createToken({ domain, name = "Authorization", value = "maestro-token" }) {
      return (await trpc("siteAuthTokens.create", { domain, name, value, type: "header" })).id;
    },
    profileName: ({ is } = {}) =>
      onceItIs(async () => (await query("user.get")).user.name, is, "the name"),
    tokenDomains: ({ is } = {}) =>
      onceItIs(
        async () => (await query("siteAuthTokens.list")).map((token) => token.domain).sort(),
        is,
        "site tokens"
      ),
    apiKeyNames: ({ is } = {}) =>
      onceItIs(
        async () => (await query("user.get")).apiKeys.map((key) => key.name).sort(),
        is,
        "API keys"
      ),
    // A recipe as the recipe form saves one; answers its id.
    async createRecipe({
      name,
      ingredients = [],
      steps = [],
      tags = [],
      categories = [],
      minutes,
    }) {
      // The form's save only attaches entries the list has, so the entries are made first.
      for (const tag of tags) await trpc("lists.add", { kind: "tag", name: tag });
      for (const category of categories) {
        await trpc("lists.add", { kind: "category", name: category });
      }

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
        categories,
        images: [],
        videos: [],
      });
    },
    async countRecipes(name) {
      return (await recipes(name)).filter((recipe) => recipe.name === name).length;
    },
    // The grocery names once there are at least `min` of them, for a write still on its way.
    groceryNames: ({ min = 0, max = Infinity } = {}) =>
      namesOnceThere(
        async () => (await query("groceries.list")).groceries.map((grocery) => grocery.name),
        { min, max }
      ),
    // A grocery as another member adds it, filed under the Store named `store`; answers its id.
    async createGrocery({ name, store }) {
      const storeId = store ? await storeIdOf(store) : null;
      const [created] = await trpc("groceries.create", [
        { name, unit: null, amount: null, ...(storeId && { storeId }) },
      ]);

      return created.id;
    },
    // Where the grocery `name` stands: now, or once it matches `want` (`done`, `store` as a Store's
    // name or null, `repeats`), throwing after `within` ms (15 s) with where it is instead.
    async groceryWhere(name, want = {}, { within = 15_000 } = {}) {
      const deadline = Date.now() + within;

      for (;;) {
        const { groceries, recurringGroceries } = await query("groceries.list");
        const stores = await query("stores.list");
        const found = groceries.find((grocery) => grocery.name === name);
        const at = found && {
          done: found.isDone,
          store: stores.find((store) => store.id === found.storeId)?.name ?? null,
          repeats: recurringGroceries.some(
            (recurring) => recurring.id === found.recurringGroceryId
          ),
        };
        const there = Object.entries(want).every(([field, value]) => at?.[field] === value);

        if (at && there) return at;
        if (Date.now() > deadline) {
          throw new Error(
            `waited ${within / 1000} s for grocery "${name}" on ${JSON.stringify(want)}; it is ${JSON.stringify(at ?? null)}`
          );
        }
        await sleep(250);
      }
    },
    // The Stores' names in their order, once they are `is` when that is given.
    async storeNames({ is } = {}) {
      const deadline = Date.now() + 15_000;

      for (;;) {
        const names = (await query("stores.list"))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((store) => store.name);

        if (!is || JSON.stringify(names) === JSON.stringify(is)) return names;
        if (Date.now() > deadline) {
          throw new Error(
            `waited 15 s for stores ${JSON.stringify(is)}; they are ${JSON.stringify(names)}`
          );
        }
        await sleep(250);
      }
    },
    // The aisle `store` files `food` (a catalogue food's name) under: now, or once it is `is` (a
    // name, or null for none), throwing after 15 s with where it is instead.
    async filedAisle({ store, food, is }) {
      const stores = await query("stores.list");
      const found = stores.find((candidate) => candidate.name === store);

      if (!found) throw new Error(`no Store named "${store}"`);

      const { items } = await query("ingredients.list", {
        search: food,
        locale: "en",
        listedOnly: false,
      });
      const ids = new Set(
        items
          .filter((item) => item.name.toLowerCase() === food.toLowerCase())
          .map((item) => item.id)
      );
      const deadline = Date.now() + 15_000;

      for (;;) {
        const links = await query("stores.aisleLinks");
        const link = links.find((one) => one.storeId === found.id && ids.has(one.ingredientId));
        const aisle =
          found.aisles.find((candidate) => candidate.id === link?.aisleId)?.name ?? null;

        if (aisle === is) return { aisle };
        if (Date.now() > deadline) {
          throw new Error(`waited 15 s for ${food} at ${store} under ${is}; it is under ${aisle}`);
        }
        await sleep(250);
      }
    },
    // A Store of `aisles` (names, in order); answers its id.
    createStore({ name, aisles = [] }) {
      return trpc("stores.create", {
        name,
        aisles: aisles.map((aisle) => ({ id: randomUUID(), name: aisle })),
      });
    },
    // The local day `offset` days from today, as the app keys it.
    dayKey: (offset) => dateKey(addDays(new Date(), offset)),
    // Where the first plan of recipe `name` stands: now, or once it is on `want`'s date and slot,
    // throwing after 15 s with where it is instead.
    async plannedWhere(name, want = {}) {
      const range = plannedRange();
      const deadline = Date.now() + 15_000;

      for (;;) {
        const items = await query("calendar.listItems", range);
        const found = items.find((item) => item.recipeName === name);
        const at = { date: found?.date ?? null, slot: found?.slot ?? null };
        const there = (want.date ?? at.date) === at.date && (want.slot ?? at.slot) === at.slot;

        if (want.absent ? !found : found && there) return at;
        if (Date.now() > deadline) {
          throw new Error(
            `waited 15 s for "${name}" on ${JSON.stringify(want)}; it is on ${JSON.stringify(at)}`
          );
        }
        await sleep(250);
      }
    },
    // A plan on `offset` days from today, in `slot`: a recipe by name, or a note's `title`.
    async createPlanned({ recipeName, title, offset, slot }) {
      const recipe = recipeName && (await recipes(recipeName)).find((r) => r.name === recipeName);

      if (recipeName && !recipe) throw new Error(`no recipe named "${recipeName}"`);

      return trpc("calendar.createItem", {
        date: dateKey(addDays(new Date(), offset)),
        slot,
        ...(recipe ? { itemType: "recipe", recipeId: recipe.id } : { itemType: "note", title }),
      });
    },
    // The same for the Pantry's foods.
    pantryNames: ({ min = 0, max = Infinity } = {}) =>
      namesOnceThere(async () => (await query("pantry.list")).map((item) => item.name), {
        min,
        max,
      }),
    // A food another member keeps in the Pantry, as typed.
    addPantry: ({ name }) => trpc("pantry.add", { name }),
    // How the Pantry holds a food kept from the catalogue (the one `search` names exactly) and one kept as typed.
    async pantryKept(search, custom, min) {
      const entries = [];

      await namesOnceThere(
        async () => {
          entries.splice(0, entries.length, ...(await query("pantry.list")));

          return entries;
        },
        { min }
      );

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
