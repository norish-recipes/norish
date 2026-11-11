import { redirect } from "next/navigation";
import { SETTINGS_HREF } from "@/components/settings/settings-tab";

export default function SettingsPage() {
  redirect(SETTINGS_HREF);
}
