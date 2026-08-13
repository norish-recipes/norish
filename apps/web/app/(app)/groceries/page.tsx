import { cookies } from "next/headers";
import {
  groceryGroupSimilarPreference,
  groceryViewModePreference,
} from "@/lib/grocery-preferences";

import { GroceriesScreen } from "./groceries-screen";

export default async function GroceriesPage() {
  // Rendering the stored view and grouping server-side is what keeps a
  // recipe-view reader from watching the store-grouped list paint first.
  const cookieStore = await cookies();

  return (
    <GroceriesScreen
      initialGroupSimilar={groceryGroupSimilarPreference.parse(
        cookieStore.get(groceryGroupSimilarPreference.cookieName)?.value
      )}
      initialViewMode={groceryViewModePreference.parse(
        cookieStore.get(groceryViewModePreference.cookieName)?.value
      )}
    />
  );
}
