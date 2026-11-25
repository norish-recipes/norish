import { NextResponse } from "next/server";
import { serverPackage } from "@/lib/server-package";

const { canAccessResource } = await serverPackage<typeof import("@norish/auth/permissions")>(
  "@norish/auth/permissions"
);
const { readSessionPrincipal } =
  await serverPackage<typeof import("@norish/auth/session")>("@norish/auth/session");
const { isUserServerAdmin } = await serverPackage<typeof import("@norish/db")>("@norish/db");
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
 * The check of a recipe or cookbook media route: the reader must be able to
 * open what the file belongs to, under the recipe permission policy. A file
 * with no owner (an orphaned recipe, or one the new-recipe form has not saved
 * yet) is served to any signed-in reader, as the permission layer answers for
 * it. A refusal is answered as if the file were missing.
 */
export async function refuseUnlessViewer(
  req: Request,
  ownerOf: () => Promise<string | null>
): Promise<Response | null> {
  const principal = await readSessionPrincipal(req.headers).catch(() => null);

  if (!principal) return notFound();

  const ownerId = await ownerOf();

  if (ownerId === null) return null;

  const household = await getCachedHouseholdForUser(principal.userId);

  if (!household) return notFound();

  const viewer = { userId: principal.userId, householdId: household.id, isServerAdmin: false };
  const allowed =
    (await canAccessResource("view", viewer, ownerId)) ||
    (await isUserServerAdmin(principal.userId));

  return allowed ? null : notFound();
}
