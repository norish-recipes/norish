import { test as base, expect } from "@playwright/test";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { writeKeyFile } from "@norish/shared-server/master-key";

import { MASTER_KEY } from "../harness/environment";
import { hydratingBrowser } from "../harness/hydration";
import { ProductionStack } from "../harness/production-stack";

export const OWNER = {
  email: "master-key-owner@norish.test",
  password: "master-key-owner-password-1",
  name: "Master Key Owner",
};
export const MEMBER = {
  email: "master-key-member@norish.test",
  password: "master-key-member-password-1",
  name: "Master Key Member",
};

/**
 * A stack of its own in file mode: MASTER_KEY unset, so the key lives in the uploads volume's key
 * file as a generated one does. Its server restarts under its specs, so no other project shares it.
 */
export const test = base.extend<Record<never, never>, { stack: ProductionStack }>({
  browser: [async ({ browser }, use) => use(hydratingBrowser(browser)), { scope: "worker" }],
  stack: [
    async ({}, use) => {
      const stack = new ProductionStack({
        project: "master-key",
        databaseName: "norish_master_key_e2e",
        users: [OWNER, MEMBER],
        // Blank counts as unset, which is file mode.
        environment: { MASTER_KEY: "" },
      });

      // The first boot adopts the key file's key, the one this worker's repositories open.
      SERVER_CONFIG.UPLOADS_DIR = stack.uploadsDir;
      await writeKeyFile({ current: MASTER_KEY }, { replace: true });
      try {
        await stack.start();
        await use(stack);
      } finally {
        await stack.stop();
      }
    },
    { scope: "worker" },
  ],
});

export { expect };
