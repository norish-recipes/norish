import { dbLogger as log } from "@norish/shared-server/logger";

/** A once-per-version pass at boot, null where it had run. A failure never stops the server. */
export async function runOnBoot(
  pass: () => Promise<unknown>,
  messages: { skipped: string; failed: string }
): Promise<void> {
  try {
    if ((await pass()) === null) log.info(messages.skipped);
  } catch (error) {
    log.warn({ err: error }, `${messages.failed}; the next boot retries`);
  }
}
