import { redirect } from "next/navigation";

export default function CalDavSettingsPage() {
  redirect("/settings?tab=caldav");
}
