import { redirect } from "next/navigation";
import { settingsHref } from "@/components/settings/settings-tab";

export default function SettingsPage() {
  redirect(settingsHref("account"));
}
