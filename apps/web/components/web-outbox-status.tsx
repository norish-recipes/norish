"use client";

import { useCallback } from "react";

import { useWebOutboxDiagnostics, useWebOutboxResults } from "@norish/shared-react/outbox";

import { getWebOutboxUserId } from "../lib/offline-delivery-user";

export function WebOutboxStatus() {
  const getScope = useCallback(async () => {
    const userId = await getWebOutboxUserId();

    return userId && typeof window !== "undefined"
      ? { backendOrigin: window.location.origin, userId }
      : null;
  }, []);
  const diagnostics = useWebOutboxDiagnostics(getScope);
  const { results, opened, open, acknowledge } = useWebOutboxResults(getScope);
  const activeCount = diagnostics.pending + diagnostics.retrying;
  const attentionCount = diagnostics.quarantined + diagnostics.terminal + diagnostics.expired;

  if (activeCount === 0 && attentionCount === 0 && results.length === 0) return null;

  return (
    <div
      data-web-outbox-status
      aria-live="polite"
      className="bg-content1/95 text-foreground rounded-medium shadow-medium fixed right-4 bottom-4 z-50 max-w-sm border px-4 py-3 text-sm"
    >
      {activeCount > 0 ? (
        <p>
          {activeCount} change{activeCount === 1 ? "" : "s"} waiting for delivery.
        </p>
      ) : null}
      {diagnostics.retrying > 0 ? (
        <p className="text-muted">Retrying when the backend is available.</p>
      ) : null}
      {attentionCount > 0 ? (
        <div className="text-warning mt-1">
          <p>
            {attentionCount} queued change{attentionCount === 1 ? " needs" : "s need"} attention.
          </p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {diagnostics.attention.map((item) => (
              <li key={item.id}>
                {item.path}: {item.code ?? item.state}
                {item.message ? ` — ${item.message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {results.length > 0 ? (
        <div className="mt-2 border-t pt-2">
          <p className="font-medium">Completed delivery results</p>
          {results.map((result) => (
            <div key={result.id} className="mt-1">
              <button className="underline" type="button" onClick={() => void open(result)}>
                {result.path}
              </button>
              {result.id in opened ? (
                <>
                  <pre className="mt-1 max-h-32 overflow-auto text-xs">
                    {formatResult(opened[result.id])}
                  </pre>
                  <button
                    className="text-muted underline"
                    type="button"
                    onClick={() => void acknowledge(result)}
                  >
                    Acknowledge and remove
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatResult(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
