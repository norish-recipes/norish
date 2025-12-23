import { redirect } from "next/navigation";

import { SignupClient } from "./components/signup-client";

import { isPasswordAuthEnabled, isLdapEnabled } from "@/server/auth/providers";
import { isRegistrationEnabled } from "@/config/server-config-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SignupPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  // Redirect to login if LDAP is enabled (users must use LDAP accounts)
  if (isLdapEnabled()) {
    redirect("/login");
  }

  const [passwordEnabled, registrationEnabled] = await Promise.all([
    isPasswordAuthEnabled(),
    isRegistrationEnabled(),
  ]);

  // Redirect to login if password auth or registration is disabled
  if (!passwordEnabled || !registrationEnabled) {
    redirect("/login");
  }

  const { callbackUrl = "/" } = await searchParams;

  return <SignupClient callbackUrl={callbackUrl} />;
}
