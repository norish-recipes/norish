import { IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import { QuerySeed } from "@/components/query-seed";
import { readRequestProfile } from "@/lib/request-profile";

import { DevicePreferencesForVisit } from "@norish/shared-react/reader";

/**
 * A shared recipe is often read signed-out. A signed-in reader gets their own
 * Device Preferences for this kind, so a reader who hid Ingredient Icons is
 * shown none here either; a signed-out reader gets the defaults. A change,
 * such as the fractions or decimals switch, lasts only for the visit. The
 * lines carry their icons' addresses, so the icons' provider here reads nothing.
 */
export default async function SharedRecipeLayout({
  children,
  params,
}: LayoutProps<"/share/[token]">) {
  const { token } = await params;

  return (
    <QuerySeed
      reads={async (trpc, client) => {
        const recipe = [
          client.query(trpc.recipes.getShared.queryOptions({ token })),
          client.query(trpc.recipes.sharePublicConfig.queryOptions({ token })),
        ];
        const { userId } = await readRequestProfile();

        return [
          ...recipe,
          userId !== null && client.query(trpc.user.getDevicePreferences.queryOptions()),
        ];
      }}
    >
      <DevicePreferencesForVisit>
        <IngredientIconsProvider>{children}</IngredientIconsProvider>
      </DevicePreferencesForVisit>
    </QuerySeed>
  );
}
