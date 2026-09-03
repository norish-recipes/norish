import React from "react";
import { Text, View } from "react-native";
import { AuthShell } from "@/components/shell/auth-shell";
import { styles } from "@/styles/storage-unavailable.styles";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

interface StorageUnavailableScreenProps {
  /** The failure that stopped the boot, shown verbatim as technical detail. */
  error: unknown;
  onRetry: () => void;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Shown when the app cannot read its secure storage on boot.
 *
 * Without that read the app cannot tell which backend it belongs to, and
 * guessing "not configured" would drop a server the user already set up. So
 * this is a dead end the user is told about rather than a silent blank screen.
 */
export function StorageUnavailableScreen({ error, onRetry }: StorageUnavailableScreenProps) {
  const intl = useIntl();
  const [foregroundColor, mutedColor, separatorColor] = useThemeColor([
    "foreground",
    "muted",
    "separator",
  ] as const);

  return (
    <AuthShell headingPrefix={intl.formatMessage({ id: "common.storageUnavailable.title" })}>
      <Text style={[styles.description, { color: foregroundColor }]}>
        {intl.formatMessage({ id: "common.storageUnavailable.description" })}
      </Text>

      <Button onPress={onRetry} style={styles.retryButton}>
        <Button.Label>{intl.formatMessage({ id: "common.actions.retry" })}</Button.Label>
      </Button>

      <View style={[styles.details, { borderColor: separatorColor }]}>
        <Text style={[styles.detailsLabel, { color: mutedColor }]}>
          {intl.formatMessage({ id: "common.storageUnavailable.detailsLabel" })}
        </Text>
        <Text style={[styles.detailsBody, { color: mutedColor }]}>{describeError(error)}</Text>
      </View>
    </AuthShell>
  );
}
