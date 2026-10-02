import type { DatasetFoodKey } from "@norish/shared-server/ingredients/nutrition/source-table";

/**
 * Norish's own lists in the source table (ADR-0039), the same on every
 * instance, editable only here and never sent upstream. A household that
 * disagrees corrects its own numbers, which outrank both.
 */

/**
 * The fix list: the dataset food a taxonomy entry should read, above every
 * code it carries. It mends the codes that are wrong for cooking (milk is
 * skimmed milk, corn dry grain, the broths raw chicken and dehydrated stock,
 * pistachio macadamia) and fills the most-used gaps (beef, pork, lamb, cumin,
 * beans, the spirits that would borrow pure alcohol). Each entry names a food
 * and never typed numbers; one whose food no longer exists fails the build.
 * Reviewed against the usage list in `.scratch/ingredient-nutrition/
 * research-coverage.md`.
 */
export const FIX_LIST: Readonly<Record<string, DatasetFoodKey>> = {
  // Wrong codes on the taxonomy.
  "en:milk": "ciqual:19016", // Milk, whole (average); the taxonomy says skimmed
  "en:corn": "usda:169998", // Corn, sweet, yellow, raw; the taxonomy says dry grain
  "en:chicken-broth": "usda:174536", // Soup, chicken broth, ready-to-serve; else raw chicken
  "en:beef-broth": "usda:171538", // Soup, beef broth or bouillon, ready-to-serve; else dehydrated
  "en:vegetable-broth": "usda:171583", // Soup, vegetable broth, ready to serve; else nothing
  "en:pistachio-nuts": "usda:170184", // Nuts, pistachio nuts, raw; the taxonomy says macadamia
  "en:hot-sauce": "usda:174527", // Sauce, ready-to-serve, pepper or hot; else "Sauce (average)"
  "en:sherry": "cofid:17-236", // Sherry, medium; else dry wine
  // Most-used gaps.
  "en:beef": "ciqual:6254", // Beef, minced steak, 15% fat, raw
  "en:pork": "usda:167902", // Pork, fresh, ground, raw
  "en:lamb": "cofid:18-478", // Lamb, average, raw, lean and fat
  "en:cumin": "ciqual:11042", // Cumin, seed
  "en:beans": "usda:173740", // Beans, kidney, all types, mature seeds, cooked, boiled
  "en:kidney-bean": "usda:173740", // Beans, kidney, all types, mature seeds, cooked, boiled
  "en:black-bean": "usda:173735", // Beans, black, mature seeds, cooked, boiled
  "en:barley": "usda:170284", // Barley, pearled, raw
  "en:smoked-sausage": "usda:174585", // Sausage, smoked link sausage, pork and beef
  "en:fish-sauce": "usda:174531", // Sauce, fish, ready-to-serve
  // Drinks that would borrow pure alcohol at 660 kcal.
  "en:beer": "ciqual:5001", // Beer, regular (4-5° alcohol)
  "en:brandy": "ciqual:1023", // Brandy, Armagnac or Cognac type
  "en:cognac": "ciqual:1023", // Brandy, Armagnac or Cognac type
  "en:whiskey": "ciqual:1005", // Whisky
  "en:tequila": "cofid:17-247", // Spirits, 40% volume
};

/**
 * The density fixes: the USDA food whose measured spoon or cup a taxonomy
 * entry's density is taken from, for its density alone; its numbers keep
 * their own source. CIQUAL weighs no spoons, so an entry whose numbers come
 * from CIQUAL and whose taxonomy entry has no USDA code had no density of
 * its own. A fix on a group whose foods share a form gives the group a
 * density its members borrow: spices, sauces, syrups, vinegars and creams,
 * never dairy as a whole, cheese, herbs, fruit, vegetables or meat, whose
 * foods differ too much for one figure. Each entry names a USDA food with a
 * density, or the build fails.
 */
export const DENSITY_FIXES: Readonly<Record<string, DatasetFoodKey>> = {
  "en:cumin": "usda:170923", // Spices, cumin seed: 0.40
  "en:butter": "usda:173430", // Butter, without salt: 0.95
  "en:margarine": "usda:172346", // Margarine, regular, 80% fat, composite, stick: 0.95
  "en:baking-powder": "usda:172803", // Leavening agents, baking powder, double-acting: 0.92
  // A spoon of yeast is dry yeast, whichever yeast the line names.
  "en:yeast": "usda:175043", // Leavening agents, yeast, baker's, active dry: 0.80
  "en:dry-baker's-yeast": "usda:175043",
  "en:cocoa": "usda:169593", // Cocoa, dry powder, unsweetened: 0.36; "cacao" is the powder
  "en:cocoa-powder": "usda:169593",
  "en:breadcrumbs": "usda:174928", // Bread, crumbs, dry, grated, plain: 0.45
  "en:soy-sauce": "usda:174277", // Soy sauce made from soy and wheat (shoyu): 1.06
  "en:mustard": "usda:172234", // Mustard, prepared, yellow: 1.04
  "en:mayonnaise": "usda:171009", // Salad dressing, mayonnaise, regular: 0.92
  "en:tomato-concentrate": "usda:170459", // Tomato products, canned, paste: 1.10
  "en:worcestershire-sauce": "usda:171610", // Sauce, worcestershire: 1.15
  "en:pesto": "usda:171579", // Sauce, pesto, ready-to-serve, refrigerated: 1.05
  "en:white-wine": "usda:174837", // Alcoholic beverage, wine, table, white: 0.99
  "en:parmigiano-reggiano": "usda:171247", // Cheese, parmesan, grated: 0.42; spooned, it is grated
  // Ricotta's own USDA code names a sample the table does not carry.
  "en:ricotta": "usda:170851", // Cheese, ricotta, whole milk: 1.03
  "en:rice": "usda:169756", // Rice, white, long-grain, regular, raw: 0.77
  // Creams whose numbers come by name, from foods nobody weighed by the cup; poured, never whipped.
  "en:heavy-cream": "usda:170859", // Cream, fluid, heavy whipping: 0.99
  "en:whipping-cream": "usda:170858", // Cream, fluid, light whipping: 1.00
  // USDA's agave has ¼ cup at 55 g (0.92), against its own teaspoon at 6.9 g (1.38) and the
  // labels' 21 g a tablespoon: honey weighs the same per spoon.
  "en:agave-syrup": "usda:169640", // Honey: 1.41
  // Coconut lends its grated meat's 0.33 to its kinds, never-lend or not; its fat is an oil.
  "en:coconut-fat": "usda:171412", // Oil, coconut: 0.91
  // Groups whose foods share a form.
  "en:spice": "usda:170924", // Spices, curry powder: 0.42, ground spices' median 0.43
  "en:sauce": "usda:171595", // Sauce, tomato chili sauce, bottled: 1.14, sauces' median 1.12
  "en:syrup": "usda:168839", // Syrups, table blends, corn, refiner, and sugar: 1.32
  "en:sugar-syrup": "usda:168839",
  "en:glucose-syrup": "usda:168837", // Syrups, corn, light: 1.42
  "en:invert-sugar-syrup": "usda:168837", // golden syrup's
  "en:vinegar": "usda:172237", // Vinegar, distilled: 0.99, and vinegar's own
  // Every poured or spooned cream weighs 0.96-1.01; cream still never lends its numbers.
  "en:cream": "usda:170857", // Cream, fluid, light (coffee cream or table cream): 1.00
};

/**
 * The lenders that never lend: entries whose numbers are wrong for most of
 * their children (a leave-one-out test found each wrong at least half the
 * time). A child of one has no numbers rather than an average sauce's or
 * pure alcohol's; the walk up the tree ends at them. Only the numbers' walk:
 * an average sauce misleads about calories, not about what a spoonful weighs.
 */
export const NEVER_LEND: readonly string[] = [
  "en:sauce",
  "en:alcohol",
  "en:coconut",
  "en:soy-protein",
  "en:ham",
  "en:cod",
  "en:chicken-meat",
  "en:beef-meat",
  "en:cream",
  "en:wine",
  "en:fruit",
];
