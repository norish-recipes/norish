import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("mcp:post-write");

export type PostWriteStep = "publish" | "announce" | "cleanup" | "read";
export type PostWriteResource = "recipe" | "planned-item";

export async function runPostWrite(
  userId: string,
  resource: PostWriteResource,
  resourceId: string,
  step: PostWriteStep,
  task: () => Promise<void>
): Promise<boolean> {
  try {
    await task();

    return true;
  } catch (error) {
    log.error(
      {
        userId,
        resource,
        resourceId,
        step,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "Post-write step failed"
    );

    return false;
  }
}
