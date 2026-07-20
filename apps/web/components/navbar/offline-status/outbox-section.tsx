"use client";

import { Button, Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { useWebOutboxDiagnostics, useWebOutboxResults } from "@norish/shared-react/outbox";

type OutboxSectionProps = {
  diagnostics: ReturnType<typeof useWebOutboxDiagnostics>;
  resultsState: ReturnType<typeof useWebOutboxResults>;
};

function formatResult(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function OutboxSection({ diagnostics, resultsState }: OutboxSectionProps) {
  const t = useTranslations("navbar.offline");
  const { acknowledge, open, opened, results } = resultsState;
  const activeCount = diagnostics.pending + diagnostics.retrying;
  const attentionCount = diagnostics.quarantined + diagnostics.terminal + diagnostics.expired;

  return (
    <section
      aria-labelledby="offline-queue-heading"
      className="border-border mt-5 flex flex-col gap-3 border-t pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold" id="offline-queue-heading">
          {t("queue.title")}
        </h3>
        <div className="flex gap-2">
          {activeCount > 0 ? (
            <Chip color="warning" size="sm" variant="soft">
              {t("queue.active", { count: activeCount })}
            </Chip>
          ) : null}
          {attentionCount > 0 ? (
            <Chip color="danger" size="sm" variant="soft">
              {t("queue.attention", { count: attentionCount })}
            </Chip>
          ) : null}
        </div>
      </div>
      {diagnostics.retrying > 0 ? (
        <p className="text-muted text-sm">{t("queue.retrying", { count: diagnostics.retrying })}</p>
      ) : null}
      {attentionCount > 0 ? (
        <ul className="flex flex-col gap-2">
          {diagnostics.attention.map((item) => (
            <li key={item.id} className="bg-warning-soft rounded-xl p-3 text-sm">
              <p className="font-medium">{item.path}</p>
              <p className="text-muted mt-0.5 text-xs">
                {item.code ?? item.state}
                {item.message ? ` — ${item.message}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {activeCount === 0 && attentionCount === 0 && results.length === 0 ? (
        <p className="text-muted text-sm">{t("queue.empty")}</p>
      ) : null}
      {results.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("queue.results", { count: results.length })}</p>
          {results.map((result) => (
            <div key={result.id} className="border-border rounded-xl border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{result.path}</span>
                <Button size="sm" variant="tertiary" onPress={() => void open(result)}>
                  {t("actions.openResult")}
                </Button>
              </div>
              {result.id in opened ? (
                <div className="mt-2">
                  <pre className="bg-surface-secondary max-h-40 overflow-auto rounded-lg p-2 text-xs">
                    {formatResult(opened[result.id])}
                  </pre>
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="secondary"
                    onPress={() => void acknowledge(result)}
                  >
                    {t("actions.acknowledge")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
