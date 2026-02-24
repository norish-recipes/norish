import { redirect } from "next/navigation";

import { isPasswordAuthEnabled } from "@norish/auth/providers";
import { isRegistrationEnabled } from "@norish/config/server-config-loader";

import { SignupClient } from "./components/signup-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SignupPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
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
