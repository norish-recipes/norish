import { OfflineBootstrap } from "./offline-bootstrap";

/**
 * The offline navigation fallback (ADR-0006, reworked by ADR-0009): served by
 * the service worker when a document navigation fails and there is no cached
 * copy of the requested page — a deep link or an unvisited route while
 * Offline. Pages visited while Live are served from the runtime page cache
 * and never reach this fallback.
 *
 * The document itself stays a static, precacheable shell that never embeds a
 * signed-in user's data (ADR-0005). After hydration the client bootstrap
 * mounts the normal provider stack and boots the requested Warm Set surface
 * from the persisted cache; unwarmed recipes and unsupported routes get the
 * explicit Offline-unavailable state.
 */
export default function OfflineFallbackPage() {
  return <OfflineBootstrap />;
}
