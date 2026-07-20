"use client";

import type { OfflineDataState } from "@/components/navbar/offline-status/display";
import type { WebConnectivitySnapshot } from "@/lib/connectivity";
import { useCallback, useState } from "react";
import { connectivityColor, dataColor } from "@/components/navbar/offline-status/display";
import { Timestamp } from "@/components/timestamp";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Alert, Button, Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

type ConnectivitySectionProps = {
  connectivity: WebConnectivitySnapshot;
  dataState: OfflineDataState;
  lastLiveSuccessAt: number | null;
  retryConnection: () => Promise<boolean>;
};

export function ConnectivitySection({
  connectivity,
  dataState,
  lastLiveSuccessAt,
  retryConnection,
}: ConnectivitySectionProps) {
  const t = useTranslations("navbar.offline");
  const [retryFailed, setRetryFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const retry = useCallback(async () => {
    setIsRetrying(true);
    setRetryFailed(false);
    const succeeded = await retryConnection();

    setRetryFailed(!succeeded);
    setIsRetrying(false);
  }, [retryConnection]);

  return (
    <section aria-labelledby="offline-status-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold" id="offline-status-heading">
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
          <Timestamp fallback={t("status.never")} value={lastLiveSuccessAt} />
        </dd>
      </dl>
      <div>
        <Button
          isPending={isRetrying || connectivity.recoveryInProgress}
          size="sm"
          variant="secondary"
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
  );
}
