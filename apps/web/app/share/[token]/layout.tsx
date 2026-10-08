import { IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import { DevicePreferencesProvider } from "@/context/device-preferences-context";
import { readDevicePreferencesSeed } from "@/lib/request-profile";

/**
 * A shared recipe is often read signed-out. A signed-in reader gets their own
 * Device Preferences for this kind, so a reader who hid Ingredient Icons is
 * shown none here either; a signed-out reader gets the defaults, and the
 * fractions or decimals switch lasts only for the visit. The lines carry
 * their icons' addresses, so the icons' provider here reads nothing.
 */
export default async function SharedRecipeLayout({ children }: { children: React.ReactNode }) {
  return (
    <DevicePreferencesProvider seed={await readDevicePreferencesSeed()}>
      <IngredientIconsProvider>{children}</IngredientIconsProvider>
    </DevicePreferencesProvider>
  );
}
