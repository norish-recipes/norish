import type { SessionRoleUser } from "@/lib/auth/server-admin";
import { hasServerAdminRole } from "@/lib/auth/server-admin";
import { ARCHIVE_PROBE_PARAM, ARCHIVE_PROBE_VALUE } from "@/lib/export/archive-download-protocol";

import { auth } from "@norish/auth/auth";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { buildNorishArchiveForViewer } from "@norish/shared-server/archive/norish-export";
import { NORISH_ARCHIVE_EXTENSION } from "@norish/shared-server/archive/norish-format";
import { getCachedHouseholdForUser } from "@norish/shared-server/cache/household";
import { serverLogger as log } from "@norish/shared-server/logger";

export const runtime = "nodejs";

type ZipStream = NodeJS.ReadableStream & { destroy?: (error?: Error) => void };

/**
 * Wrap the archive's node stream in a web ReadableStream with backpressure,
 * so a slow download pauses the export instead of buffering it in memory.
 *
 * Chunks are copied rather than enqueued as views: the consumer reads them
 * after this callback returns, and the bytes underneath may belong to a
 * pooled buffer that is reused by then. An abandoned download destroys the
 * archive so its open file handles go with it.
 */
function nodeStreamToWeb(nodeStream: ZipStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        controller.enqueue(Uint8Array.from(chunk));

        if ((controller.desiredSize ?? 0) <= 0) {
          nodeStream.pause();
        }
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (error) => controller.error(error));
    },
    pull() {
      nodeStream.resume();
    },
    cancel() {
      nodeStream.pause();
      nodeStream.destroy?.();
    },
  });
}

/**
 * The instance-wide doorway. Both scopes are the same operation, format, and
 * route; the scope only says which viewer context the visibility layer is
 * asked with — and this one is admin-only (ADR-0022).
 */
const INSTANCE_SCOPE = "instance";

/**
 * Recipe Archive export: streams a `.norishrecipes` zip of every recipe the
 * signed-in user can see under the deployment's view policy, or — with
 * `?scope=instance`, for a server admin — every recipe on the instance. The
 * archive is generated straight into the response — no temp file or stored
 * artifact ever exists server-side (ADR-0022).
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionUser = session.user as SessionRoleUser & {
    id: string;
    name?: string | null;
  };

  const isServerAdmin = hasServerAdminRole(sessionUser);
  const params = new URL(req.url).searchParams;
  const instanceScope = params.get("scope") === INSTANCE_SCOPE;

  // Admin scope is server-authorised, never presentation-gated: hiding the
  // admin doorway is not what keeps a non-admin out of it.
  if (instanceScope && !isServerAdmin) {
    return new Response("Forbidden", { status: 403 });
  }

  if (params.get(ARCHIVE_PROBE_PARAM) === ARCHIVE_PROBE_VALUE) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const household = await getCachedHouseholdForUser(sessionUser.id);
  const householdUserIds = household?.users.map((user: { id: string }) => user.id) ?? [];

  const exportedAt = new Date();
  const { stream, recipeCount } = await buildNorishArchiveForViewer({
    ctx: {
      userId: sessionUser.id,
      householdUserIds: householdUserIds.length > 0 ? householdUserIds : null,
      // The exporter's own reach, from either doorway. An admin's library
      // already lists every recipe on the instance — `recipes.list` asks the
      // visibility layer with this same flag — so "everything the exporter can
      // see" *is* the whole instance for them, and the admin button is
      // discoverability rather than privileged extra data (ADR-0022).
      isServerAdmin,
    },
    exporter: {
      name: sessionUser.name ?? null,
      origin: SERVER_CONFIG.AUTH_URL,
    },
    exportedAt,
  });

  const date = exportedAt.toISOString().slice(0, 10);
  const fileName = `norish-recipes-${date}${NORISH_ARCHIVE_EXTENSION}`;

  log.info(
    { userId: sessionUser.id, recipeCount, scope: instanceScope ? INSTANCE_SCOPE : "viewer" },
    "Streaming Recipe Archive export"
  );

  return new Response(nodeStreamToWeb(stream), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
