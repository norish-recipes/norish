import { cookies } from "next/headers";
import { AmountDisplayProvider } from "@/context/amount-display-context";
import { amountDisplayPreference } from "@/lib/amount-display";

/**
 * A shared recipe is read signed-out, but the amount format is a device
 * preference, not an account one — the cookie rides along and the server
 * pass seeds it so amounts arrive in the reader's format here too.
 */
export default async function SharedRecipeLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  return (
    <AmountDisplayProvider initialValue={amountDisplayPreference.readFrom(cookieStore)}>
      {children}
    </AmountDisplayProvider>
  );
}
