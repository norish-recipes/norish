import { HEALTH_PROBE_PATH, probeBackendReachable as probe } from "@norish/shared-react/offline";
import { addBasePath } from "@norish/shared/lib/base-path";

/** The readiness route under the web client's base path. */
export const HEALTH_PROBE_URL = addBasePath(HEALTH_PROBE_PATH);

/** The Live/Offline verdict: one probe against the readiness route. */
export const probeBackendReachable = (): Promise<boolean> => probe(HEALTH_PROBE_URL);
