import { saveServerAddress } from "@/lib/network/server-address";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-address");

/** Saves the Server Address; a failure is logged and rejects again, for the caller to answer. */
export async function saveServerAddressLogged(address: string): Promise<void> {
  try {
    await saveServerAddress(address);
  } catch (error) {
    log.error({ error }, "Could not save the Server Address");
    throw error;
  }
}
