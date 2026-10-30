import { recheckUndecidedMintsOnRungChange } from "@norish/shared-server/ingredients/seed/recheck-mints";

import { runOnBoot } from "./run-on-boot";

/**
 * The undecided mints an instance's history left, looked at again once per change to the
 * resolver's rules (ADR-0039), after the first seed so there is a catalogue to reach.
 */
export async function recheckUndecidedMintsOnBoot(): Promise<void> {
  await runOnBoot(recheckUndecidedMintsOnRungChange, {
    skipped: "Undecided mints already looked at under the current rules",
    failed: "Looking at undecided mints again failed",
  });
}
