import { cookies } from "next/headers";
import {
  groceryGroupSimilarPreference,
  groceryViewModePreference,
} from "@/lib/grocery-preferences";

import { GroceriesScreen } from "./groceries-screen";

/**
 * Both views of Groceries under one layout, which renders the view itself:
 * the pages only give each view an address, so switching between the list
 * and the Pantry stays on the client. Rendering the stored view and grouping
 * server-side is what keeps a recipe-view reader from watching the
 * store-grouped list paint first.
 */
export default async function GroceriesLayout() {
  const cookieStore = await cookies();

  return (
    <GroceriesScreen
      initialGroupSimilar={groceryGroupSimilarPreference.readFrom(cookieStore)}
      initialViewMode={groceryViewModePreference.readFrom(cookieStore)}
    />
  );
}
