import React from "react";
import { StatusBadge } from "@/features/auth/components/status-badge";
import { StatusScreen } from "@/features/auth/components/status-screen";
import { useIntl } from "react-intl";

interface StorageUnavailableScreenProps {
  /** Re-reads storage; the read itself logs each failure. */
  onRetry: () => void;
}

/** Shown when secure storage can't be read on boot: guessing "not configured" would drop the
 * server already set up, so the app stops here and says so. */
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
