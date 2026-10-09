import { Dashboard } from "@/components/dashboard/dashboard";

// Signed in by now: the proxy sends anyone else to the login page.
export default function Home() {
  return <Dashboard />;
}
