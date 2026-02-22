import { redirect } from "next/navigation";

export default function UserSettingsPage() {
  redirect("/settings?tab=user");
}
