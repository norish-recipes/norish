import { redirect } from "next/navigation";

export default function HouseholdSettingsPage() {
  redirect("/settings?tab=household");
}
