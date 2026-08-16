import { auth } from "@norish/auth/auth";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { buildNorishArchiveForViewer } from "@norish/shared-server/archive/norish-export";
import { NORISH_ARCHIVE_EXTENSION } from "@norish/shared-server/archive/norish-format";
import { getCachedHouseholdForUser } from "@norish/shared-server/cache/household";
import { serverLogger as log } from "@norish/shared-server/logger";

export const runtime = "nodejs";

/** JSZip types its stream as the bare interface; the object is a real Readable. */
type ZipStream = NodeJS.ReadableStream & { destroy?: (error?: Error) => void };

/**
 * Wrap JSZip's node stream in a web ReadableStream with backpressure, so a
 * slow download pauses zip generation instead of buffering it in memory.
 *
 * Chunks are copied rather than enqueued as views: the consumer reads them
 * after this callback returns, and the bytes underneath may belong to a
 * pooled buffer that is reused by then. An abandoned download destroys the
 * generator so its open file handles go with it.
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
 * Recipe Archive export: streams a `.norishrecipes` zip of every recipe the
 * signed-in user can see under the deployment's view policy. The archive is
 * generated straight into the response — no temp file or stored artifact
 * ever exists server-side (ADR-0022).
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionUser = session.user as {
    id: string;
    name?: string | null;
    isServerAdmin?: boolean;
    isServerOwner?: boolean;
  };

  const household = await getCachedHouseholdForUser(sessionUser.id);
  const householdUserIds = household?.users.map((user: { id: string }) => user.id) ?? [];

  const exportedAt = new Date();
  const { zip, recipeCount } = await buildNorishArchiveForViewer({
    ctx: {
      userId: sessionUser.id,
      householdUserIds: householdUserIds.length > 0 ? householdUserIds : null,
      isServerAdmin: Boolean(sessionUser.isServerOwner || sessionUser.isServerAdmin),
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

  const nodeStream = zip.generateNodeStream({
    type: "nodebuffer",
    streamFiles: true,
    compression: "DEFLATE",
  });

  return new Response(nodeStreamToWeb(nodeStream), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
