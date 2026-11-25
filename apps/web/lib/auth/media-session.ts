import { NextResponse } from "next/server";
import { serverPackage } from "@/lib/server-package";

const { canAccessResource } = await serverPackage<typeof import("@norish/auth/permissions")>(
  "@norish/auth/permissions"
);
const { readSessionPrincipal } =
  await serverPackage<typeof import("@norish/auth/session")>("@norish/auth/session");
const { getCachedHouseholdForUser } = await serverPackage<
  typeof import("@norish/shared-server/cache/household")
>("@norish/shared-server/cache/household");

function notFound(): Response {
  return NextResponse.json(
    { error: "Not found" },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * The session check of a signed-in media route: a request without a session
 * is answered as if the file were missing, and the answer is not cached. It
 * reads the session alone, with no database lookup.
 */
export async function refuseWithoutSession(req: Request): Promise<Response | null> {
  const principal = await readSessionPrincipal(req.headers).catch(() => null);

  return principal ? null : notFound();
}

/**
 * The check of a recipe or cookbook media route: the reader must be able to view what the file
 * belongs to under the Permission Policy, admins included. A file of no recipe yet (one the
 * new-recipe form has not saved) is served to any signed-in reader; a refusal reads as missing.
 */
export async function refuseUnlessViewer(
  req: Request,
  householdOf: () => Promise<string | null>
): Promise<Response | null> {
  const principal = await readSessionPrincipal(req.headers).catch(() => null);

  if (!principal) return notFound();

  const rowHouseholdId = await householdOf();

  if (rowHouseholdId === null) return null;

  const household = await getCachedHouseholdForUser(principal.userId);

  if (!household) return notFound();

  return (await canAccessResource("view", household.id, rowHouseholdId)) ? null : notFound();
}
