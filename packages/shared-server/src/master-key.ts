import { initMasterKey } from "@norish/config/crypto";
import { SERVER_CONFIG } from "@norish/config/env-config-server";

/** Pick the Master Key and open it: once, after the database is reachable and before any crypto. */
export async function resolveMasterKey(): Promise<void> {
  initMasterKey(Buffer.from(SERVER_CONFIG.MASTER_KEY, "base64"));
}
