import { AppShell } from "@/app/(app)/app-shell";
import { readDevicePreferencesSeed } from "@/lib/request-profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The reader's Device Preferences for this request's Device Kind, read
  // once, so the shell seeds the very first render. The offline bootstrap
  // mounts the same shell unseeded and reads the restored profile instead.
  return <AppShell devicePreferences={await readDevicePreferencesSeed()}>{children}</AppShell>;
}
