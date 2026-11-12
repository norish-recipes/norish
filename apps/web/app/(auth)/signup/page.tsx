import { redirect } from "next/navigation";
import { SignupScreen } from "@/features/auth/signup-screen";

import { isPasswordAuthEnabled } from "@norish/auth/providers";
import { isRegistrationEnabled } from "@norish/shared-server/config/server-config-loader";
import { APP_ROOT } from "@norish/shared/lib/base-path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const [passwordEnabled, registrationEnabled] = await Promise.all([
    isPasswordAuthEnabled(),
    isRegistrationEnabled(),
  ]);

  // Redirect to login if password auth or registration is disabled
  if (!passwordEnabled || !registrationEnabled) {
    redirect("/login");
  }

  const { callbackUrl } = await searchParams;

  // A repeated parameter arrives as a list; only a single one is a destination.
  return <SignupScreen callbackUrl={typeof callbackUrl === "string" ? callbackUrl : APP_ROOT} />;
}
