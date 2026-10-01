import { recheckUndecidedMintsOnRungChange } from "@norish/shared-server/ingredients/seed/recheck-mints";
import { dbLogger as log } from "@norish/shared-server/logger";

/**
 * Look at the Flagged Ingredients an instance's history left behind again,
 * once per change to the resolver's rules (ADR-0039): legacy lines such as
 * "salt to taste" reach the seeded Ingredients they name, without AI. After
 * the first seed, so there is a catalogue to reach. A failure never stops
 * the server; the next boot tries again.
 */
export async function recheckUndecidedMintsOnBoot(): Promise<void> {
  try {
    const outcome = await recheckUndecidedMintsOnRungChange();

    if (!outcome) log.info("Undecided mints already looked at under the current rules");
  } catch (error) {
    log.warn({ err: error }, "Looking at undecided mints again failed; the next boot retries");
  }
}
