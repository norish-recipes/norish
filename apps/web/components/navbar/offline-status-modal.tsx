"use client";

import type { RefObject } from "react";
import { useCallback, useMemo, useState } from "react";
import { useOfflineWeb } from "@/context/offline-web-context";
import {
  ArrowPathIcon,
  CircleStackIcon,
  CloudIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Alert, Button, Chip, Modal, Switch } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { WebReadCacheInventoryItem } from "@norish/web/lib/offline-read-cache";
import { useWebOutboxDiagnostics, useWebOutboxResults } from "@norish/shared-react/outbox";

import { useWebConnectivity, webConnectivityRuntime } from "../../lib/connectivity";
import { getWebOutboxUserId } from "../../lib/offline-delivery-user";

type OfflineStatusModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

type DataState = "live" | "cached" | "stale" | "unavailable";

// This explicit reference lets Next.js remove the simulator from production bundles.
// eslint-disable-next-line no-restricted-properties
const SHOW_BACKEND_SIMULATOR = isBackendSimulatorEnabled(process.env.NODE_ENV);

export function isBackendSimulatorEnabled(environment: string | undefined): boolean {
  return environment === "development";
}

function formatResult(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function maxTimestamp(...values: Array<number | null>): number | null {
  const timestamps = values.filter((value): value is number => value !== null);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

export default function OfflineStatusModal({
  isOpen,
  onOpenChange,
  returnFocusRef,
}: OfflineStatusModalProps) {
  const t = useTranslations("navbar.offline");
  const offline = useOfflineWeb();
  const connectivity = useWebConnectivity();
  const [retryFailed, setRetryFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [simulationFailed, setSimulationFailed] = useState(false);
  const [simulationPending, setSimulationPending] = useState(false);
  const getOutboxScope = useCallback(async () => {
    const userId = await getWebOutboxUserId();

    return userId && typeof window !== "undefined"
      ? { backendOrigin: window.location.origin, userId }
      : null;
  }, []);
  const diagnostics = useWebOutboxDiagnostics(getOutboxScope);
  const { results, opened, open, acknowledge } = useWebOutboxResults(getOutboxScope);
  const activeCount = diagnostics.pending + diagnostics.retrying;
  const attentionCount = diagnostics.quarantined + diagnostics.terminal + diagnostics.expired;
  const dataState = useMemo<DataState>(() => {
    if (offline.phase === "live" && !offline.usingCachedData) return "live";
    if (offline.usingCachedData) return offline.phase === "live" ? "stale" : "cached";
    if (offline.phase === "unavailable") return "unavailable";

    return "stale";
  }, [offline.phase, offline.usingCachedData]);
  const lastLiveSuccessAt = maxTimestamp(
    connectivity.lastSuccessAt,
    offline.inventory.lastLiveSuccessAt,
    offline.activeScope?.lastLiveSuccessAt ?? null
  );
  const inventoryRows = useMemo(
    () =>
      [
        ["recipeSummaries", offline.inventory.recipeSummaries],
        ["recipeDetails", offline.inventory.recipeDetails],
        ["calendarItems", offline.inventory.calendarItems],
        ["groceries", offline.inventory.groceries],
        ["recurringGroceries", offline.inventory.recurringGroceries],
        ["stores", offline.inventory.stores],
      ] as const,
    [offline.inventory]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      if (open) return;

      setConfirmingClear(false);
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    },
    [onOpenChange, returnFocusRef]
  );

  const retry = useCallback(async () => {
    setIsRetrying(true);
    setRetryFailed(false);
    const succeeded = await offline.retryConnection();

    setRetryFailed(!succeeded);
    setIsRetrying(false);
  }, [offline]);

  const clearCache = useCallback(async () => {
    setIsClearing(true);
    try {
      await offline.clearCachedData();
      setConfirmingClear(false);
    } finally {
      setIsClearing(false);
    }
  }, [offline]);

  const setSimulation = useCallback(async (enabled: boolean) => {
    setSimulationPending(true);
    setSimulationFailed(false);
    const succeeded = await webConnectivityRuntime.setSimulatedBackendUnavailable(enabled);

    setSimulationFailed(!succeeded);
    setSimulationPending(false);
  }, []);

  return (
    <Modal.Backdrop
      className="z-[1099]"
      isOpen={isOpen}
      variant="blur"
      onOpenChange={handleOpenChange}
    >
      <Modal.Container className="z-[1100]" placement="auto" size="lg">
        <Modal.Dialog className="max-h-[calc(100dvh-2rem)] sm:max-w-2xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-default text-foreground">
              <CloudIcon className="size-5" />
            </Modal.Icon>
            <Modal.Heading>{t("title")}</Modal.Heading>
            <p className="text-muted text-sm">{t("description")}</p>
          </Modal.Header>
          <Modal.Body className="overflow-y-auto">
            <section aria-labelledby="offline-status-heading" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="offline-status-heading" className="font-semibold">
                  {t("status.title")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Chip color={connectivityColor(connectivity.state)} size="sm" variant="soft">
                    {t(`connectivity.${connectivity.state}`)}
                  </Chip>
                  <Chip color={dataColor(dataState)} size="sm" variant="soft">
                    {t(`data.${dataState}`)}
                  </Chip>
                </div>
              </div>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">{t("status.lastLiveSuccess")}</dt>
                <dd className="text-right">
                  <Timestamp value={lastLiveSuccessAt} fallback={t("status.never")} />
                </dd>
              </dl>
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  isPending={isRetrying || connectivity.recoveryInProgress}
                  onPress={() => void retry()}
                >
                  <ArrowPathIcon className="size-4" />
                  {t("actions.retry")}
                </Button>
              </div>
              {retryFailed ? (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t("status.retryFailed")}</Alert.Title>
                  </Alert.Content>
                </Alert>
              ) : null}
            </section>

            <section
              aria-labelledby="offline-cache-heading"
              className="border-border mt-5 flex flex-col gap-3 border-t pt-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 id="offline-cache-heading" className="font-semibold">
                  {t("cache.title")}
                </h3>
                <span className="text-muted text-xs">
                  {t("cache.schema", { version: offline.inventory.schemaVersion })}
                </span>
              </div>
              {offline.inventory.totalRecords === 0 ? (
                <p className="text-muted text-sm">{t("cache.empty")}</p>
              ) : (
                <dl className="divide-border divide-y text-sm">
                  {inventoryRows.map(([key, item]) => (
                    <InventoryRow key={key} label={t(`inventory.${key}`)} item={item} />
                  ))}
                </dl>
              )}
              {offline.persistenceWarning ? (
                <Alert status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t("cache.persistenceWarning")}</Alert.Title>
                    <Alert.Description>
                      {t(`warnings.${offline.persistenceWarning.code}`)}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
              {confirmingClear ? (
                <div className="border-danger/30 bg-danger-soft rounded-xl border p-3">
                  <p className="text-sm font-medium">{t("cache.clearConfirm")}</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onPress={() => setConfirmingClear(false)}>
                      {t("actions.cancel")}
                    </Button>
                    <Button
                      isPending={isClearing}
                      size="sm"
                      variant="danger"
                      onPress={() => void clearCache()}
                    >
                      {t("actions.clear")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button
                    isDisabled={!offline.activeScope || offline.inventory.totalRecords === 0}
                    size="sm"
                    variant="secondary"
                    onPress={() => setConfirmingClear(true)}
                  >
                    <CircleStackIcon className="size-4" />
                    {t("actions.clear")}
                  </Button>
                </div>
              )}
            </section>

            <section
              aria-labelledby="offline-queue-heading"
              className="border-border mt-5 flex flex-col gap-3 border-t pt-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="offline-queue-heading" className="font-semibold">
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
                <p className="text-muted text-sm">
                  {t("queue.retrying", { count: diagnostics.retrying })}
                </p>
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
                  <p className="text-sm font-medium">
                    {t("queue.results", { count: results.length })}
                  </p>
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

            {SHOW_BACKEND_SIMULATOR ? (
              <section
                aria-labelledby="offline-simulation-heading"
                className="border-border mt-5 border-t pt-5"
                data-development-simulator
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="offline-simulation-heading" className="font-semibold">
                      {t("simulation.title")}
                    </h3>
                    <p className="text-muted mt-1 text-sm">{t("simulation.description")}</p>
                  </div>
                  <Switch
                    aria-label={t("simulation.title")}
                    isDisabled={simulationPending}
                    isSelected={connectivity.simulatedBackendUnavailable}
                    onChange={(selected) => void setSimulation(selected)}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>
                {simulationFailed ? (
                  <p className="text-danger mt-2 flex items-center gap-1 text-sm">
                    <ExclamationTriangleIcon className="size-4" />
                    {t("simulation.disableFailed")}
                  </p>
                ) : null}
              </section>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              {t("actions.close")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Timestamp({ value, fallback }: { value: number | null; fallback: string }) {
  if (value === null) return fallback;

  const date = new Date(value);

  return <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>;
}

function InventoryRow({ label, item }: { label: string; item: WebReadCacheInventoryItem }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
      <dt>{label}</dt>
      <dd className="text-right">
        <span className="font-medium tabular-nums">{item.count}</span>
        {item.dataUpdatedAt ? (
          <span className="text-muted ml-2 text-xs">
            <Timestamp value={item.dataUpdatedAt} fallback="" />
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function connectivityColor(state: ReturnType<typeof useWebConnectivity>["state"]) {
  if (state === "online") return "success" as const;
  if (state === "checking") return "default" as const;

  return "danger" as const;
}

function dataColor(state: DataState) {
  if (state === "live") return "success" as const;
  if (state === "unavailable") return "danger" as const;

  return "warning" as const;
}
