import React from "react";
import { StatusBadge } from "@/features/auth/components/status-badge";
import { StatusScreen } from "@/features/auth/components/status-screen";
import { useIntl } from "react-intl";

interface StorageUnavailableScreenProps {
  /** Re-reads storage; the read itself logs each failure. */
  onRetry: () => void;
}

/**
 * Shown when the app cannot read its secure storage on boot.
 *
 * Without that read the app cannot tell which backend it belongs to, and
 * guessing "not configured" would drop a server the user already set up. So
 * this is a dead end the user is told about rather than a silent blank screen.
 */
export function StorageUnavailableScreen({ onRetry }: StorageUnavailableScreenProps) {
  const intl = useIntl();

  return (
    <StatusScreen
      action={{
        label: intl.formatMessage({ id: "common.errorPage.retry" }),
        testID: "storage-unavailable-retry",
        onPress: onRetry,
      }}
      badge={<StatusBadge variant="storage" />}
      description={intl.formatMessage({ id: "common.storageUnavailable.description" })}
      descriptionTestID="storage-unavailable-description"
      title={intl.formatMessage({ id: "common.storageUnavailable.title" })}
      titleTestID="storage-unavailable-title"
    />
  );
}
