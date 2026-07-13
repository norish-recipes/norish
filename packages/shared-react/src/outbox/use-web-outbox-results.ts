"use client";

import { useCallback, useEffect, useState } from "react";

import type { WebOutboxResult, WebOutboxScope } from "./outbox-types";
import { WebOutboxRepository } from "./outbox-repository";

const repository = new WebOutboxRepository();

export function useWebOutboxResults(getScope: () => Promise<WebOutboxScope | null>) {
  const [results, setResults] = useState<WebOutboxResult[]>([]);
  const [opened, setOpened] = useState<Record<string, unknown>>({});

  const refresh = useCallback(async () => {
    const scope = await getScope();

    if (!scope) {
      setResults([]);

      return;
    }

    try {
      setResults(await repository.listResults(scope));
    } catch {
      setResults([]);
    }
  }, [getScope]);

  useEffect(() => {
    void refresh();
    window.addEventListener("norish:web-outbox-changed", refresh);

    return () => window.removeEventListener("norish:web-outbox-changed", refresh);
  }, [refresh]);

  const open = useCallback(async (result: WebOutboxResult) => {
    const value = await repository.readResult(result);

    setOpened((current) => ({ ...current, [result.id]: value }));
  }, []);

  const acknowledge = useCallback(
    async (result: WebOutboxResult) => {
      await repository.consumeResult(result);
      setOpened((current) => {
        const next = { ...current };

        delete next[result.id];

        return next;
      });
      await refresh();
    },
    [refresh]
  );

  return { results, opened, open, acknowledge };
}
