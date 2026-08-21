import { Agent } from "undici";

const globalAgentCache = globalThis as typeof globalThis & {
  __norishSingletonAgent?: Agent;
  __norishConfiguredAgentTimeoutMs?: number;
};

export function getCachedAgent(timeoutMs: number): Agent {
  if (
    !globalAgentCache.__norishSingletonAgent ||
    globalAgentCache.__norishConfiguredAgentTimeoutMs !== timeoutMs
  ) {
    void globalAgentCache.__norishSingletonAgent?.close();
    globalAgentCache.__norishSingletonAgent = new Agent({
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
    globalAgentCache.__norishConfiguredAgentTimeoutMs = timeoutMs;
  }

  return globalAgentCache.__norishSingletonAgent;
}

/**
 * `fetch` that gives up on an idle connection after `timeoutMs`.
 *
 * The global fetch on purpose, so a test or a deployment that patches
 * `globalThis.fetch` still sees these calls. That is why the `undici`
 * dependency is pinned to the major Node bundles: a dispatcher is only
 * understood by the undici that built it, and an Agent from a newer major
 * reaches the built-in fetch as "invalid onRequestStart method". Move the pin
 * when the Node version in .nvmrc bundles a new undici major.
 */
export function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  const dispatcher = getCachedAgent(timeoutMs);

  return (url, init) => fetch(url, { ...init, dispatcher } as RequestInit);
}
