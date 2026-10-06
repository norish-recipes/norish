import { cookies } from "next/headers";
import { IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import { AmountDisplayProvider } from "@/context/amount-display-context";
import { HiddenItemsProvider } from "@/context/hidden-items-context";
import { RecipePageColorProvider } from "@/context/recipe-page-color-context";
import { amountDisplayPreference } from "@/lib/amount-display";
import { hiddenItemsPreference } from "@/lib/hidden-items";
import { recipePageColorPreference } from "@/lib/recipe-page-color";

/**
 * A shared recipe is read signed-out, but the amount format is a device
 * preference, not an account one — the cookie rides along and the server
 * pass seeds it so amounts arrive in the reader's format here too. Hidden
 * Items ride the same way, so a reader who hid Ingredient Icons is shown none
 * on a shared recipe either; the lines carry their icons' addresses, so the
 * icons' provider here reads nothing.
 */
export default async function SharedRecipeLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  return (
    <AmountDisplayProvider initialValue={amountDisplayPreference.readFrom(cookieStore)}>
      <RecipePageColorProvider initialValue={recipePageColorPreference.readFrom(cookieStore)}>
        <HiddenItemsProvider initialHiddenItems={hiddenItemsPreference.readFrom(cookieStore)}>
          <IngredientIconsProvider>{children}</IngredientIconsProvider>
        </HiddenItemsProvider>
      </RecipePageColorProvider>
    </AmountDisplayProvider>
  );
}
