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
  // Drinks that would borrow pure alcohol at 660 kcal.
  "en:beer": "ciqual:5001", // Beer, regular (4-5° alcohol)
  "en:brandy": "ciqual:1023", // Brandy, Armagnac or Cognac type
  "en:cognac": "ciqual:1023", // Brandy, Armagnac or Cognac type
  "en:whiskey": "ciqual:1005", // Whisky
  "en:tequila": "cofid:17-247", // Spirits, 40% volume
};

/**
 * The lenders that never lend: entries whose numbers are wrong for most of
 * their children (a leave-one-out test found each wrong at least half the
 * time). A child of one has no numbers rather than an average sauce's or
 * pure alcohol's; the walk up the tree ends at them.
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
