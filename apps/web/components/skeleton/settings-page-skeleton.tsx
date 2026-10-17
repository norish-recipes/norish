"use client";

import type { SettingsShape } from "@/app/(app)/settings/settings-tab";
import { SettingsTabs } from "@/app/(app)/settings/components/settings-tabs";
import { SettingsTabSkeleton } from "@/components/skeleton/settings-skeleton";

/**
 * The settings page while its route loads: the real title and tab bar, and the
 * open tab's {@link SettingsTabSkeleton}, which every later wait draws too.
 */
export default function SettingsPageSkeleton({ shape }: { shape: SettingsShape }) {
  return <SettingsTabs panel={(tab) => <SettingsTabSkeleton tab={tab} />} shape={shape} />;
}
