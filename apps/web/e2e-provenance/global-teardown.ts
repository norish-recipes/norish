/**
 * Tear down the harness's dedicated Postgres/Redis after the suite, removing
 * the isolated volumes so no provenance-suite state is left behind.
 */
import { composeDown } from "./server";

export default function globalTeardown(): void {
  composeDown();
}
