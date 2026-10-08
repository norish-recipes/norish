import z from "zod";

export const DEVICE_KINDS = ["phone", "desktop"] as const;

export type DeviceKind = (typeof DEVICE_KINDS)[number];

export const GROCERY_VIEW_MODES = ["store", "recipe"] as const;

export type GroceryViewMode = (typeof GROCERY_VIEW_MODES)[number];

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
});

export type DevicePreferences = z.output<typeof DevicePreferencesSchema>;

export const DEVICE_PREFERENCE_DEFAULTS: DevicePreferences = DevicePreferencesSchema.parse({});

/** A stored block, whatever shape it is in, as full values. */
export function parseDevicePreferences(block: unknown): DevicePreferences {
  return DevicePreferencesSchema.catch(DEVICE_PREFERENCE_DEFAULTS).parse(block);
}

const shape = DevicePreferencesSchema.shape;

/** A write names any of the choices and rejects a value outside its set. */
export const SetDevicePreferencesInputSchema = z.object({
  kind: z.enum(DEVICE_KINDS),
  preferences: z
    .object({
      groceryViewMode: shape.groceryViewMode.unwrap(),
      groceryGroupSimilar: shape.groceryGroupSimilar.unwrap(),
    })
    .partial()
    .strict(),
});

export type DevicePreferencesUpdate = z.infer<
  typeof SetDevicePreferencesInputSchema
>["preferences"];
