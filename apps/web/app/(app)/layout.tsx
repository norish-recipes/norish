import { cookies } from "next/headers";
import { AppShell } from "@/app/(app)/app-shell";
import { amountDisplayPreference } from "@/lib/amount-display";
import { hiddenItemsPreference } from "@/lib/hidden-items";
import { recipePageColorPreference } from "@/lib/recipe-page-color";
import { readDevicePreferencesSeed } from "@/lib/request-profile";
import { todaysMealsVisibilityPreference } from "@/lib/todays-meals-visibility";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Device preferences every (app) route consults are read here, once,
  // so the shell's providers seed the very first render. The offline
  // bootstrap mounts the same shell with nothing seeded and the providers
  // read the cookies themselves.
  const cookieStore = await cookies();

  return (
    <AppShell
      devicePreferences={await readDevicePreferencesSeed()}
      initialAmountDisplayMode={amountDisplayPreference.readFrom(cookieStore)}
      initialHiddenItems={hiddenItemsPreference.readFrom(cookieStore)}
      initialRecipePageColor={recipePageColorPreference.readFrom(cookieStore)}
      initialTodaysMealsVisibility={todaysMealsVisibilityPreference.readFrom(cookieStore)}
    >
      {children}
    </AppShell>
  );
}
