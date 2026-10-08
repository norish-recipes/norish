import z from "zod";

import type { AmountDisplayMode } from "../../lib/format-amount";

export const DEVICE_KINDS = ["phone", "desktop"] as const;

export type DeviceKind = (typeof DEVICE_KINDS)[number];

export const GROCERY_VIEW_MODES = ["store", "recipe"] as const;

export type GroceryViewMode = (typeof GROCERY_VIEW_MODES)[number];

export const AMOUNT_DISPLAY_MODES = [
  "fraction",
  "decimal",
] as const satisfies readonly AmountDisplayMode[];

/** Recipe pages take their hue from the dish (ADR-0023) or stay on the theme. */
export const RECIPE_PAGE_COLORS = ["dish", "theme"] as const;

export type RecipePageColorMode = (typeof RECIPE_PAGE_COLORS)[number];

/** Today's meals on the dashboard: always, only when something is planned, or hidden. */
export const TODAY_SECTION_VISIBILITIES = ["always", "planned", "hidden"] as const;

export type TodaySectionVisibility = (typeof TODAY_SECTION_VISIBILITIES)[number];

export const RECIPE_VIEW_MODES = ["grid", "list"] as const;

export type RecipeDashboardViewMode = (typeof RECIPE_VIEW_MODES)[number];

/**
 * The Hidden Items list. It has no closed set: a control that writes the
 * whole list back must carry entries it cannot show (a gated-off entry, one
 * from a newer version), so entries are kept whatever they name.
 */
const HiddenItemsSchema = z.array(z.string().min(1).max(64)).max(64);

/**
 * Every Device Preference with its values and its default, the one place a
 * preference is declared. A stored block holds only the choices made on its
 * kind; this parse lands every value on a valid one or its default, so an
 * absent or broken choice reads as the default.
 */
export const DevicePreferencesSchema = z.object({
  groceryViewMode: z.enum(GROCERY_VIEW_MODES).catch("store"),
  /** Group similar ingredients (store view only). */
  groceryGroupSimilar: z.boolean().catch(true),
  amountDisplay: z.enum(AMOUNT_DISPLAY_MODES).catch("fraction"),
  hiddenItems: HiddenItemsSchema.catch([]),
  recipePageColor: z.enum(RECIPE_PAGE_COLORS).catch("dish"),
  todaysMeals: z.enum(TODAY_SECTION_VISIBILITIES).catch("always"),
  recipeViewMode: z.enum(RECIPE_VIEW_MODES).catch("grid"),
});

export type DevicePreferences = z.output<typeof DevicePreferencesSchema>;

export const DEVICE_PREFERENCE_DEFAULTS: DevicePreferences = DevicePreferencesSchema.parse({});

/** A stored block, whatever shape it is in, as full values. */
export function parseDevicePreferences(block: unknown): DevicePreferences {
  return DevicePreferencesSchema.catch(DEVICE_PREFERENCE_DEFAULTS).parse(block);
}

const shape = DevicePreferencesSchema.shape;

/** Each choice without its fallback, so a write rejects a value outside its set. */
const strictShape = Object.fromEntries(
  Object.entries(shape).map(([key, choice]) => [key, choice.unwrap()])
) as { [K in keyof typeof shape]: ReturnType<(typeof shape)[K]["unwrap"]> };

/** A write names any of the choices for one Device Kind. */
export const SetDevicePreferencesInputSchema = z.object({
  kind: z.enum(DEVICE_KINDS),
  preferences: z.object(strictShape).partial().strict(),
});

export type DevicePreferencesUpdate = z.infer<
  typeof SetDevicePreferencesInputSchema
>["preferences"];
