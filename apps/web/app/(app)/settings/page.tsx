import type { SessionRoleUser } from "@/lib/auth/server-admin";
import { headers } from "next/headers";
import { hasServerAdminRole } from "@/lib/auth/server-admin";

import { auth } from "@norish/auth/auth";

import SettingsPageContent from "./components/settings-page-content";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Hiding the tab is presentation only — every admin procedure authorises
  // server-side.
  const showAdminTab = hasServerAdminRole(session?.user as SessionRoleUser | undefined);

  return <SettingsPageContent showAdminTab={showAdminTab} />;
}
