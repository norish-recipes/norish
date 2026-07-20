"use client";

import type { OfflineDataState } from "@/components/navbar/offline-status/display";
import type { OfflineWebPhase } from "@/context/offline-web-context";
import type { WebConnectivityState } from "@/lib/connectivity";
import type { RefObject } from "react";
import { useCallback, useMemo } from "react";
import { CacheSection } from "@/components/navbar/offline-status/cache-section";
import { ConnectivitySection } from "@/components/navbar/offline-status/connectivity-section";
import { OutboxSection } from "@/components/navbar/offline-status/outbox-section";
import { SimulatorSection } from "@/components/navbar/offline-status/simulator-section";
import { useOfflineWeb } from "@/context/offline-web-context";
import { useWebConnectivity } from "@/lib/connectivity";
import { getWebOutboxUserId } from "@/lib/offline-delivery-user";
import { CloudIcon } from "@heroicons/react/24/outline";
import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useWebOutboxDiagnostics, useWebOutboxResults } from "@norish/shared-react/outbox";

type OfflineStatusModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

export type { OfflineDataState } from "@/components/navbar/offline-status/display";

// This explicit reference lets Next.js remove the simulator from production bundles.
// eslint-disable-next-line no-restricted-properties
const SHOW_BACKEND_SIMULATOR = process.env.NODE_ENV === "development";

export function isBackendSimulatorEnabled(environment: string | undefined): boolean {
  return environment === "development";
}

export function getOfflineDataState({
  connectivityState,
  phase,
  usingCachedData,
  visibleDataUnavailable,
}: {
  connectivityState: WebConnectivityState;
  phase: OfflineWebPhase;
  usingCachedData: boolean;
  visibleDataUnavailable: boolean;
}): OfflineDataState {
  if (visibleDataUnavailable || phase === "unavailable") return "unavailable";
  if (connectivityState !== "online") return usingCachedData ? "cached" : "stale";
  if (phase === "live" && !usingCachedData) return "live";
  if (usingCachedData) return phase === "live" ? "stale" : "cached";

  return "stale";
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
  const getOutboxScope = useCallback(async () => {
    const userId = await getWebOutboxUserId();

    return userId && typeof window !== "undefined"
      ? { backendOrigin: window.location.origin, userId }
      : null;
  }, []);
  const diagnostics = useWebOutboxDiagnostics(getOutboxScope);
  const resultsState = useWebOutboxResults(getOutboxScope);
  const dataState = useMemo(
    () =>
      getOfflineDataState({
        connectivityState: connectivity.state,
        phase: offline.phase,
        usingCachedData: offline.usingCachedData,
        visibleDataUnavailable: offline.visibleDataUnavailable,
      }),
    [connectivity.state, offline.phase, offline.usingCachedData, offline.visibleDataUnavailable]
  );
  const lastLiveSuccessAt = maxTimestamp(
    connectivity.lastSuccessAt,
    offline.inventory.lastLiveSuccessAt,
    offline.activeScope?.lastLiveSuccessAt ?? null
  );
  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      if (open) return;

      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    },
    [onOpenChange, returnFocusRef]
  );

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
            <ConnectivitySection
              connectivity={connectivity}
              dataState={dataState}
              lastLiveSuccessAt={lastLiveSuccessAt}
              retryConnection={offline.retryConnection}
            />
            <CacheSection
              activeScope={offline.activeScope}
              clearCachedData={offline.clearCachedData}
              inventory={offline.inventory}
              isOpen={isOpen}
              persistenceWarning={offline.persistenceWarning}
            />
            <OutboxSection diagnostics={diagnostics} resultsState={resultsState} />
            {SHOW_BACKEND_SIMULATOR ? <SimulatorSection connectivity={connectivity} /> : null}
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
