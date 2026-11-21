import { redirect } from "next/navigation";
import { SignupScreen } from "@/features/auth/signup-screen";
import { serverPackage } from "@/lib/server-package";

import { APP_ROOT } from "@norish/shared/lib/base-path";

const { isPasswordAuthEnabled } =
  await serverPackage<typeof import("@norish/auth/providers")>("@norish/auth/providers");
const { isRegistrationEnabled } = await serverPackage<
  typeof import("@norish/shared-server/config/server-config-loader")
>("@norish/shared-server/config/server-config-loader");

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const [passwordEnabled, registrationEnabled] = await Promise.all([
    isPasswordAuthEnabled(),
    isRegistrationEnabled(),
  ]);

  if (!passwordEnabled || !registrationEnabled) {
    redirect("/login");
  }

  const { callbackUrl } = await searchParams;

  // A repeated parameter arrives as a list; only a single one is a destination.
  return <SignupScreen callbackUrl={typeof callbackUrl === "string" ? callbackUrl : APP_ROOT} />;
}
