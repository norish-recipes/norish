import { cookies, headers } from "next/headers";
import { AppShell } from "@/app/(app)/app-shell";
import { amountDisplayPreference } from "@/lib/amount-display";
import { todaysMealsVisibilityPreference } from "@/lib/todays-meals-visibility";

import { auth } from "@norish/auth/auth";
import { getUserPreferences } from "@norish/db/repositories/users";
import { UserPreferencesSchema } from "@norish/shared/contracts/zod/user";
import { getHiddenItems } from "@norish/shared/lib/user-preferences";

/**
 * The reader's hidden list, read while producing the HTML. Parsed exactly
 * the way `user.get` parses it, so the seed and the live list always agree.
 */
async function readHiddenItems(): Promise<readonly string[] | undefined> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return undefined;
  }

  const parsed = UserPreferencesSchema.safeParse(await getUserPreferences(session.user.id));

  return getHiddenItems({ preferences: parsed.success ? parsed.data : {} });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Device preferences every (app) route consults are read here, once,
  // so the shell's providers seed the very first render. The offline
  // bootstrap mounts the same shell with nothing seeded and the providers
  // read the cookies themselves. The hidden list is not a device
  // preference — it lives server-side — but it seeds the same way, so
  // nothing hidden is ever painted first.
  const cookieStore = await cookies();

  return (
    <AppShell
      initialAmountDisplayMode={amountDisplayPreference.readFrom(cookieStore)}
      initialHiddenItems={await readHiddenItems()}
      initialTodaysMealsVisibility={todaysMealsVisibilityPreference.readFrom(cookieStore)}
    >
      {children}
    </AppShell>
  );
}
