import { auth } from "@norish/auth/auth";
import { buildCatalogueExport } from "@norish/shared-server/ingredients/seed/catalogue-export";
import { serverLogger as log } from "@norish/shared-server/logger";

export const runtime = "nodejs";

/**
 * The ingredient catalogue as JSON, for any signed-in user: the catalogue is
 * derived from the Open Food Facts taxonomy under the ODbL, which asks that a
 * derived database be offered in a machine-readable form (ADR-0038).
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const exportedAt = new Date();
  const catalogue = await buildCatalogueExport(exportedAt);
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
