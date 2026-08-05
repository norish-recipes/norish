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

export function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  const dispatcher = getCachedAgent(timeoutMs);

  return (url, init) => fetch(url, { ...init, dispatcher } as any);
}
