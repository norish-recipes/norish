import { headers } from "next/headers";
import SettingsPageContent from "./components/settings-page-content";

import { auth } from "@norish/auth/auth";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // The role rides on the session the server already resolved; the client
  // cannot write these fields (input: false in the auth config). Hiding the
  // tab is presentation only — every admin procedure authorises server-side.
  const sessionUser = session?.user as
    | { isServerAdmin?: boolean; isServerOwner?: boolean }
    | undefined;
  const showAdminTab = Boolean(sessionUser?.isServerOwner || sessionUser?.isServerAdmin);

  return <SettingsPageContent showAdminTab={showAdminTab} />;
}
