"use client";

import { useState } from "react";
import Panel from "@/components/Panel/Panel";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { OFFLINE_FORCED_AVAILABLE } from "@/lib/connectivity";
import {
  ArrowPathIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ShoppingCartIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Button, Modal } from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";

import type { OfflineStatus } from "./use-offline-status";
import { useOfflineStatus } from "./use-offline-status";

interface OfflineStatusModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The connection & offline status modal (commit 9). Read-only connection
 * posture, the offline cache breakdown with a wipe control, and the Outbox with
 * sync/retry/discard — plus a dev-only forced-Offline toggle (ADR-0007). Opens
 * centered on desktop and as a bottom sheet on mobile.
 */
export function OfflineStatusModal({ isOpen, onOpenChange }: OfflineStatusModalProps) {
  const t = useTranslations("common.offlineStatus");
  const isMobile = useIsMobile();

  // Only mount the body — and thus the data layer (useTRPC, the Outbox
  // subscription, the cache reads) — while the modal is open, so a closed modal
  // costs nothing and doesn't depend on the tRPC provider being present.
  const body = isOpen ? <OfflineStatusBody /> : null;

  if (isMobile) {
    return (
      <Panel open={isOpen} title={t("title")} onOpenChange={onOpenChange}>
        <Panel.Body>{body}</Panel.Body>
      </Panel>
    );
  }

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="z-[1100]" size="md">
        <Modal.Dialog>
          {() => (
            <>
              <Modal.Header>{t("title")}</Modal.Header>
              <Modal.Body className="pb-4">{body}</Modal.Body>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function OfflineStatusBody() {
  const status = useOfflineStatus();

  return (
    <div className="flex flex-col gap-6">
      <ConnectionSection status={status} />
      <CacheSection status={status} />
      <OutboxSection status={status} />
      {OFFLINE_FORCED_AVAILABLE ? <DevToggleSection status={status} /> : null}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">{children}</h3>;
}

interface ConfirmInlineProps {
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * Inline confirm box shared by the modal's destructive actions (wipe cache,
 * discard queued changes): body text plus cancel / danger-confirm, with both
 * buttons disabled while the confirmed action runs.
 */
function ConfirmInline({
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmInlineProps) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);

    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm">{body}</p>
      <div className="flex justify-end gap-2">
        <Button isDisabled={busy} size="sm" variant="tertiary" onPress={onCancel}>
          {cancelLabel}
        </Button>
        <Button isDisabled={busy} size="sm" variant="danger" onPress={() => void confirm()}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function ConnectionSection({ status }: { status: OfflineStatus }) {
  const t = useTranslations("common.offlineStatus.connection");
  const key = status.posture === "offline-forced" ? "forced" : status.posture;
  const dotColor = status.isLive ? "bg-accent" : "bg-warning";

  return (
    <section className="flex flex-col gap-1.5">
      <SectionHeading>{t("heading")}</SectionHeading>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <span className="font-medium">{t(key)}</span>
        {status.isForced ? (
          <span className="bg-warning-soft text-warning rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
            {t("devBadge")}
          </span>
        ) : null}
      </div>
      <p className="text-muted text-sm">{t(`${key}Description`)}</p>
    </section>
  );
}

function CacheSection({ status }: { status: OfflineStatus }) {
  const t = useTranslations("common.offlineStatus.cache");
  const format = useFormatter();
  const { counts } = status;
  const [confirming, setConfirming] = useState(false);

  const items = [
    { icon: BookOpenIcon, label: t("recipes"), value: counts.recipes },
    { icon: ShoppingCartIcon, label: t("groceries"), value: counts.groceries },
    { icon: BuildingStorefrontIcon, label: t("stores"), value: counts.stores },
    { icon: CalendarDaysIcon, label: t("planned"), value: counts.plannedThisWeek },
  ];

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>{t("heading")}</SectionHeading>
      <dl className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="bg-surface-secondary flex items-center gap-2 rounded-lg px-3 py-2"
          >
            <Icon className="text-muted size-4 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <dd className="text-sm font-semibold">{value}</dd>
              <dt className="text-muted truncate text-xs">{label}</dt>
            </div>
          </div>
        ))}
      </dl>

      {status.isOffline ? (
        <p className="text-muted text-xs">
          {status.lastWarmedAt
            ? t("dataAge", { when: format.relativeTime(new Date(status.lastWarmedAt)) })
            : t("dataAgeUnknown")}
        </p>
      ) : null}

      {confirming ? (
        <ConfirmInline
          body={status.isOffline ? t("wipeConfirmOfflineBody") : t("wipeConfirmBody")}
          cancelLabel={t("wipeCancel")}
          confirmLabel={t("wipeConfirm")}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            await status.wipeCache();
            setConfirming(false);
          }}
        />
      ) : (
        <Button
          className="self-start"
          size="sm"
          variant="tertiary"
          onPress={() => setConfirming(true)}
        >
          <TrashIcon className="size-4" />
          {t("wipe")}
        </Button>
      )}
    </section>
  );
}

function OutboxSection({ status }: { status: OfflineStatus }) {
  const t = useTranslations("common.offlineStatus.outbox");
  const { outbox } = status;
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const needsAttention = outbox.parked + outbox.conflicted;

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>{t("heading")}</SectionHeading>

      {outbox.total === 0 ? (
        <p className="text-muted text-sm">{t("empty")}</p>
      ) : (
        <>
          <ul className="border-border divide-border divide-y rounded-lg border">
            {outbox.entries.map((entry) => (
              <li key={entry.seq} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate font-mono text-xs">{entry.path}</span>
                <OutboxStatusBadge status={entry.status} />
              </li>
            ))}
          </ul>
          <p className="text-muted text-xs">
            {status.isSyncing
              ? t("syncing", { count: outbox.pending })
              : t("pending", { count: outbox.pending })}
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          isDisabled={status.isForced || status.isSyncing}
          isPending={status.isSyncing}
          size="sm"
          variant="primary"
          onPress={() => void status.syncNow()}
        >
          <ArrowPathIcon className="size-4" />
          {t("syncNow")}
        </Button>
        {needsAttention > 0 ? (
          <Button size="sm" variant="tertiary" onPress={() => void status.retryAll()}>
            {t("retryAll")}
          </Button>
        ) : null}
        {outbox.total > 0 ? (
          <Button size="sm" variant="tertiary" onPress={() => setConfirmingDiscard(true)}>
            {t("discardAll")}
          </Button>
        ) : null}
      </div>

      {confirmingDiscard ? (
        <ConfirmInline
          body={t("discardConfirmBody", { count: outbox.total })}
          cancelLabel={t("discardCancel")}
          confirmLabel={t("discardConfirm")}
          onCancel={() => setConfirmingDiscard(false)}
          onConfirm={async () => {
            await status.discardAll();
            setConfirmingDiscard(false);
          }}
        />
      ) : null}
    </section>
  );
}

function OutboxStatusBadge({ status }: { status: "pending" | "parked" | "conflicted" }) {
  const t = useTranslations("common.offlineStatus.outbox");
  const styles: Record<typeof status, string> = {
    pending: "bg-accent-soft text-accent",
    parked: "bg-warning-soft text-warning",
    conflicted: "bg-danger-soft text-danger",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${styles[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}

function DevToggleSection({ status }: { status: OfflineStatus }) {
  const t = useTranslations("common.offlineStatus.devToggle");

  return (
    <section className="border-border flex flex-col gap-2 border-t pt-4">
      <SectionHeading>{t("heading")}</SectionHeading>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{t("force")}</span>
        <Button
          size="sm"
          variant={status.isForced ? "danger" : "tertiary"}
          onPress={() => status.setForcedOffline(!status.isForced)}
        >
          {status.isForced ? t("on") : t("off")}
        </Button>
      </div>
      <p className="text-muted text-xs">{t("description")}</p>
    </section>
  );
}

export default OfflineStatusModal;
