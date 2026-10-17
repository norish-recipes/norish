import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/(app)/app-shell";
import { readQuerySeed } from "@/components/query-seed";
import { DESTINATION_HEADER, loginPath } from "@/lib/auth/login-redirect";
import { readReaderToday } from "@/lib/reader-today-server";
import { readDevicePreferencesSeed, readRequestProfile } from "@/lib/request-profile";

/**
 * The page gate of the signed-in app. The proxy only checks that a session
 * cookie is present; here the session is read and its account verified, once
 * per request, and a reader without one is sent to sign in and back.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { identity } = await readRequestProfile();

  if (!identity) {
    redirect(loginPath((await headers()).get(DESTINATION_HEADER)));
  }

  // What the shell's first render needs, read once; the offline bootstrap mounts it unseeded. Not
  // `user.get`: its API-key metadata would sit in every document the worker keeps.
  const [devicePreferences, readerToday, seed] = await Promise.all([
    readDevicePreferencesSeed(),
    readReaderToday(),
    readQuerySeed((trpc, client) => [
      client.query(trpc.permissions.get.queryOptions()),
      client.query(trpc.households.get.queryOptions()),
      client.query(trpc.favorites.list.queryOptions()),
      client.query(trpc.user.getAllergies.queryOptions()),
      client.query(trpc.recipes.getPending.queryOptions()),
    ]),
  ]);
  const { id, email, name, image, version } = identity;

  return (
    <AppShell
      devicePreferences={devicePreferences}
      reader={{ id, email, name, image, version }}
      readerToday={readerToday}
      seed={seed}
    >
      {children}
    </AppShell>
  );
}
