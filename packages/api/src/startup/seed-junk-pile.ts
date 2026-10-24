import { seedJunkPileOnce } from "@norish/shared-server/ingredients/seed/junk-pile";

import { runOnBoot } from "./run-on-boot";

/** The junk pile's seed, once per version, with or without a catalogue seed. */
export async function seedJunkPileOnBoot(): Promise<void> {
  await runOnBoot(seedJunkPileOnce, {
    skipped: "Junk pile seed already applied",
    failed: "Seeding the junk pile failed",
  });
}
