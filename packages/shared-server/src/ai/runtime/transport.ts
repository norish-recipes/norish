import type { RequestInfo as UndiciRequestInfo, RequestInit as UndiciRequestInit } from "undici";
import { Agent, fetch as undiciFetch, FormData as UndiciFormData } from "undici";

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
 * undici sends only its own FormData as multipart, and the AI SDK builds
 * Node's global one for an upload (transcription), which would otherwise go
 * out as the text "[object FormData]". Blob and File are Node's own classes,
 * shared by both, so the entries carry over as they are.
 */
function multipartBody(body: RequestInit["body"]): UndiciRequestInit["body"] {
  if (!(body instanceof FormData)) return body as UndiciRequestInit["body"];

  const form = new UndiciFormData();

  for (const [name, value] of body) form.append(name, value);

  return form;
}

/**
 * `fetch` that gives up on an idle connection after `timeoutMs`. The fetch and
 * its dispatcher come from the same undici, which is what a dispatcher needs:
 * Node's built-in fetch understands only an Agent from the undici it bundles.
 */
export function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  const dispatcher = getCachedAgent(timeoutMs);

  // undici's types for the same WHATWG objects lag the DOM lib's (no iterator
  // disposal, an extra `duplex`), so TypeScript sees no overlap; at run time
  // the objects are interchangeable, which is how Node's own fetch works.
  return (url, init) =>
    undiciFetch(url as UndiciRequestInfo, {
      ...(init as UndiciRequestInit),
      body: multipartBody(init?.body),
      dispatcher,
    }) as unknown as Promise<Response>;
}
