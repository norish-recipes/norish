import { redirect } from "next/navigation";

import { SignupClient } from "./components/signup-client";

import { isPasswordAuthEnabled } from "@/server/auth/providers";
import { isRegistrationEnabled } from "@/config/server-config-loader";

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
