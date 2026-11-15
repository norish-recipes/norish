import { QuerySeed } from "@/components/query-seed";
import { readRequestProfile } from "@/lib/request-profile";

import { DevicePreferencesForVisit } from "@norish/shared-react/reader";
import { deviceBlocks } from "@norish/shared/contracts/zod/device-preferences";

/**
 * A signed-in reader gets their own Device Preferences, a signed-out one the defaults; a change
 * lasts for the visit.
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
        const { userId, preferences } = await readRequestProfile();

        if (userId !== null) {
          client.setQueryData(trpc.user.getDevicePreferences.queryKey(), deviceBlocks(preferences));
        }

        return recipe;
      }}
    >
      <DevicePreferencesForVisit>{children}</DevicePreferencesForVisit>
    </QuerySeed>
  );
}
