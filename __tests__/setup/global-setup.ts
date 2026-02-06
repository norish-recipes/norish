// @vitest-environment node
/**
 * Global setup/teardown for test suite
 *
 * Returns a teardown function that stops the PostgreSQL container
 * after all tests complete to prevent container leaks
 */

import { stopPostgresContainer } from "@/__tests__/helpers/db-setup";

export default async function globalSetup() {
  // Return teardown function that will be called after all tests
  return async () => {
    await stopPostgresContainer();
  };
}
