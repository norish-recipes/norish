import { cookies, headers } from "next/headers";
import { Dashboard } from "@/components/dashboard/dashboard";
import { recipeViewModePreference } from "@/lib/recipe-view-mode";

import { auth } from "@norish/auth/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null; // This should never happen due to proxy

  // Rendering the library in the stored layout server-side is what keeps a list
  // reader from watching a grid paint first.
  const cookieStore = await cookies();

  return <Dashboard initialViewMode={recipeViewModePreference.readFrom(cookieStore)} />;
}
