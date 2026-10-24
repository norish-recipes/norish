import { IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import { QuerySeed } from "@/components/query-seed";
import { DevicePreferencesProvider } from "@/context/device-preferences-context";
import { readDevicePreferencesSeed } from "@/lib/request-profile";

/**
 * A shared recipe is often read signed-out. A signed-in reader gets their own
 * Device Preferences for this kind, so a reader who hid Ingredient Icons is
 * shown none here either; a signed-out reader gets the defaults, and the
 * fractions or decimals switch lasts only for the visit. The lines carry
 * their icons' addresses, so the icons' provider here reads nothing.
 */
export default async function SharedRecipeLayout({
  children,
  params,
}: LayoutProps<"/share/[token]">) {
  const { token } = await params;

  return (
    <DevicePreferencesProvider seed={await readDevicePreferencesSeed()}>
      <QuerySeed
        reads={(trpc, client) => [
          client.query(trpc.recipes.getShared.queryOptions({ token })),
          client.query(trpc.recipes.sharePublicConfig.queryOptions({ token })),
        ]}
      >
        <IngredientIconsProvider>{children}</IngredientIconsProvider>
      </QuerySeed>
    </DevicePreferencesProvider>
  );
}
