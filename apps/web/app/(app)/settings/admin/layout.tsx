import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SETTINGS_HREF } from "@/components/settings/settings-tab";
import { readRequestProfile } from "@/lib/request-profile";

// Above the admin tab's loading.tsx, so a non-admin is sent away before its skeleton shows.
export default async function AdminSettingsLayout({ children }: { children: ReactNode }) {
  const { identity } = await readRequestProfile();

  if (!identity?.isServerAdmin) redirect(SETTINGS_HREF);

  return children;
}
