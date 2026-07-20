"use client";

import type { OfflineWebContextValue } from "@/context/offline-web/shared";
import type { WebReadCacheInventoryItem, WebReadCacheRecordKind } from "@/lib/offline-read-cache";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Timestamp } from "@/components/timestamp";
import { CircleStackIcon } from "@heroicons/react/24/outline";
import { Alert, Button } from "@heroui/react";
import { useTranslations } from "next-intl";

type CacheSectionProps = Pick<
  OfflineWebContextValue,
  "activeScope" | "clearCachedData" | "inventory" | "persistenceWarning"
> & {
  isOpen: boolean;
};

const WARNING_INVENTORY_KEYS: Partial<Record<WebReadCacheRecordKind, string>> = {
  "recipe-dashboard": "recipeSummaries",
  "calendar-range": "calendarItems",
  groceries: "groceries",
  stores: "stores",
};

export function CacheSection({
  activeScope,
  clearCachedData,
  inventory,
  isOpen,
  persistenceWarning,
}: CacheSectionProps) {
  const t = useTranslations("navbar.offline");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!isOpen) setConfirmingClear(false);
  }, [isOpen]);

  const inventoryRows = useMemo(
    () =>
      [
        ["recipeSummaries", inventory.recipeSummaries],
        ["calendarItems", inventory.calendarItems],
        ["groceries", inventory.groceries],
        ["recurringGroceries", inventory.recurringGroceries],
        ["stores", inventory.stores],
      ] as const,
    [inventory]
  );
  const clearCache = useCallback(async () => {
    setIsClearing(true);
    try {
      await clearCachedData();
      setConfirmingClear(false);
    } finally {
      setIsClearing(false);
    }
  }, [clearCachedData]);
  const warningInventoryKey = persistenceWarning?.recordKind
    ? WARNING_INVENTORY_KEYS[persistenceWarning.recordKind]
    : undefined;

  return (
    <section
      aria-labelledby="offline-cache-heading"
      className="border-border mt-5 flex flex-col gap-3 border-t pt-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold" id="offline-cache-heading">
          {t("cache.title")}
        </h3>
        <span className="text-muted text-xs">
          {t("cache.schema", { version: inventory.schemaVersion })}
        </span>
      </div>
      {inventory.totalRecords === 0 ? (
        <p className="text-muted text-sm">{t("cache.empty")}</p>
      ) : (
        <dl className="divide-border divide-y text-sm">
          {inventoryRows.map(([key, item]) => (
            <InventoryRow key={key} item={item} label={t(`inventory.${key}`)} />
          ))}
        </dl>
      )}
      {persistenceWarning ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("cache.persistenceWarning")}</Alert.Title>
            <Alert.Description>
              {t(`warnings.${persistenceWarning.code}`)}
              {warningInventoryKey ? (
                <>
                  {" — "}
                  <span>{t(`inventory.${warningInventoryKey}`)}</span>
                </>
              ) : null}
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
            isDisabled={!activeScope || inventory.totalRecords === 0}
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
  );
}

function InventoryRow({ label, item }: { label: string; item: WebReadCacheInventoryItem }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
      <dt>{label}</dt>
      <dd className="text-right">
        <span className="font-medium tabular-nums">{item.count}</span>
        {item.dataUpdatedAt ? (
          <span className="text-muted ml-2 text-xs">
            <Timestamp fallback="" value={item.dataUpdatedAt} />
          </span>
        ) : null}
      </dd>
    </div>
  );
}
