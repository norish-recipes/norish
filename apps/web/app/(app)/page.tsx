import { headers } from "next/headers";
import { Dashboard } from "@/components/dashboard/dashboard";

import { auth } from "@norish/auth/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null; // This should never happen due to proxy

  return <Dashboard />;
}
