import { ARCHIVE_PROBE_PARAM, ARCHIVE_PROBE_VALUE } from "@/lib/export/archive-download-protocol";
import { serverPackage } from "@/lib/server-package";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

const { auth } = await serverPackage<typeof import("@norish/auth/auth")>("@norish/auth/auth");
const { buildNorishArchiveForViewer } = await serverPackage<
  typeof import("@norish/shared-server/archive/norish-export")
>("@norish/shared-server/archive/norish-export");
const { NORISH_ARCHIVE_EXTENSION } = await serverPackage<
  typeof import("@norish/shared-server/archive/norish-format")
>("@norish/shared-server/archive/norish-format");
const { getCachedHouseholdForUser } = await serverPackage<
  typeof import("@norish/shared-server/cache/household")
>("@norish/shared-server/cache/household");
const { serverLogger: log } = await serverPackage<typeof import("@norish/shared-server/logger")>(
  "@norish/shared-server/logger"
);

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

/** Recipe Archive export (ADR-0022): a `.norishrecipes` zip of every recipe the reader may view,
 * an admin's included, streamed straight into the response with nothing stored server-side. */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionUser = session.user;
  const params = new URL(req.url).searchParams;

  if (params.get(ARCHIVE_PROBE_PARAM) === ARCHIVE_PROBE_VALUE) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const household = await getCachedHouseholdForUser(sessionUser.id);

  if (!household) return new Response("Unauthorized", { status: 401 });

  const exportedAt = new Date();
  const { stream, recipeCount } = await buildNorishArchiveForViewer({
    ctx: {
      userId: sessionUser.id,
      householdId: household.id,
    },
    exporter: {
      name: sessionUser.name ?? null,
      origin: SERVER_CONFIG.AUTH_URL,
    },
    exportedAt,
  });

  const date = exportedAt.toISOString().slice(0, 10);
  const fileName = `norish-recipes-${date}${NORISH_ARCHIVE_EXTENSION}`;

  log.info({ userId: sessionUser.id, recipeCount }, "Streaming Recipe Archive export");

  return new Response(nodeStreamToWeb(stream), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
