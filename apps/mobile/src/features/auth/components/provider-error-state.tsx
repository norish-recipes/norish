import React from "react";
import { Button, Card, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

export function ProviderErrorState({ onRetry }: { onRetry: () => void }) {
  const intl = useIntl();
  const [dangerColor, mutedColor] = useThemeColor(["danger", "muted"] as const);

  return (
    <>
      <Card.Title style={{ color: dangerColor }}>
        {intl.formatMessage({ id: "auth.errors.default.title" })}
      </Card.Title>
      <Card.Description style={{ color: mutedColor }}>
        {intl.formatMessage({ id: "auth.errors.default.description" })}
      </Card.Description>
      <Button
        onPress={() => {
          onRetry();
        }}
      >
        <Button.Label>{intl.formatMessage({ id: "common.actions.retry" })}</Button.Label>
      </Button>
    </>
  );
}
