import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";
import { getHouseholdForUser, dashboardRecipe } from "@/server/db";
import { addImportJob } from "@/server/queue";
import { isUrl } from "@/lib/helpers";
import { parserLogger as log } from "@/server/logger";

/**
 * POST /api/import/recipe
 *
 * Import a recipe from a URL. Supports both cookie auth and API key auth.
 * Designed for iOS Shortcuts and other programmatic access.
 *
 * Request body: { url: string }
 * Headers: x-api-key (optional, for API key auth)
 *
 * Response: { recipeId: string } on success
 */
export async function POST(req: Request) {
  try {
    // Build headers for auth (supports both cookie and API key)
    const headers = new Headers();
    const apiKeyHeader = req.headers.get("x-api-key");

    if (apiKeyHeader) headers.set("x-api-key", apiKeyHeader);

    // Authenticate
    const session = await auth.api.getSession({ headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'url' in request body" },
        { status: 400 }
      );
    }

    if (!isUrl(url)) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    log.info({ userId: session.user.id, url }, "Recipe import requested via API");

    // Build job data
    const household = await getHouseholdForUser(session.user.id);
    const householdKey = household?.id ?? `user:${session.user.id}`;
    const householdUserIds = household?.users?.map((u) => u.id) ?? null;
    const recipeId = crypto.randomUUID();

    // Add to BullMQ queue
    const result = await addImportJob({
      url,
      recipeId,
      userId: session.user.id,
      householdKey,
      householdUserIds,
    });

    if (result.status === "exists" && result.existingRecipeId) {
      const existing = await dashboardRecipe(result.existingRecipeId);

      return NextResponse.json(
        { recipeId: result.existingRecipeId, recipe: existing, status: "exists" },
        { status: 200 }
      );
    }

    if (result.status === "duplicate") {
      return NextResponse.json(
        { error: "This recipe is already being imported", status: "duplicate" },
        { status: 409 }
      );
    }

    return NextResponse.json({ recipeId, status: "queued" }, { status: 202 });
  } catch (err) {
    log.error({ err }, "POST /api/import/recipe failed");

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
