import { serverPackage } from "@/lib/server-package";

const { auth } = await serverPackage<typeof import("@norish/auth/auth")>("@norish/auth/auth");
const { buildCatalogueExport } = await serverPackage<
  typeof import("@norish/shared-server/ingredients/seed/catalogue-export")
>("@norish/shared-server/ingredients/seed/catalogue-export");
const { getCachedHouseholdForUser } = await serverPackage<
  typeof import("@norish/shared-server/cache/household")
>("@norish/shared-server/cache/household");
const { serverLogger: log } = await serverPackage<typeof import("@norish/shared-server/logger")>(
  "@norish/shared-server/logger"
);

export const runtime = "nodejs";

/**
 * The ingredient catalogue as JSON, for any signed-in user: the seed and their
 * household's own foods (ADR-0042). The catalogue is derived from the Open Food
 * Facts taxonomy under the ODbL, which asks that a derived database be offered
 * in a machine-readable form (ADR-0038).
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const household = await getCachedHouseholdForUser(session.user.id);

  if (!household) return new Response("Unauthorized", { status: 401 });

  const exportedAt = new Date();
  const catalogue = await buildCatalogueExport(household.id, exportedAt);
  const fileName = `norish-ingredients-${exportedAt.toISOString().slice(0, 10)}.json`;

  log.info(
    { userId: session.user.id, ingredients: catalogue.ingredients.length },
    "Exporting the ingredient catalogue"
  );

  return new Response(JSON.stringify(catalogue), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
